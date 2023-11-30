import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createMintToCheckedInstruction,
} from "@solana/spl-token";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import {
  CLONE_TOKEN_SCALE,
  CloneClient,
  fromCloneScale,
  fromScale,
  toCloneScale,
  toScale,
} from "../sdk/src/clone";
import { createPriceFeed } from "../sdk/src/oracle";
import {
  getOrCreateAssociatedTokenAccount,
  calculateExecutionThresholdFromParams,
  calculatePoolAmounts,
  calculateSwapExecution,
} from "../sdk/src/utils";
import { getHealthScore } from "../sdk/src/healthscore";
import {
  Clone as CloneAccount,
  OracleSource,
  createUpdateOraclesInstruction,
  UpdateOraclesInstructionArgs,
} from "../sdk/generated/clone";
import {
  createInitializeInstruction,
  createMintAssetInstruction,
} from "../sdk/generated/mock-asset-faucet";
import { createSetPriceInstruction } from "../sdk/generated/pyth";
import { createTokenMint, calculateLiquidationAttacks } from "./utils";

// NOTE: Liquidations for Non Auth Enabled is always on. You can just ignore the final liquidation attack test.
const CONFIGURATION = {
  usdcMintAmount: 2_500_000,
  assetMintAmount: 400_000,
  usdcScale: 7,
  clone: {
    cometCollateralIldLiquidatorFeeBps: 100,
    cometOnassetIldLiquidatorFeeBps: 500, // Comet liquidation Reward for ILD
    borrowLiquidatorFeeBps: 1000,
  },
  pool: {
    nPools: 3,
    initialPrice: 100,
    poolTradingFee: 25,
    treasuryTradingFee: 10,
    ilHealthScoreCoefficient: 17500,
    positionHealthScoreCoefficient: 4000, // Position Loss Health Score Coefficient
    minOvercollateralRatio: 150,
    maxLiquidationOvercollateralRatio: 200,
  },
  comet: {
    liquidityToAdd: 160_000, // Committed Liquidity Provided (per pool)
    collateralToAdd: 250_000,
  },
  simulation: {
    arbitragePoolPremium: 0.1,
    marketRise: 0.1,
    externalLPShare: 0.9, // External LP Share
    externalLPHealthScore: 50,
  },
};

export const liquiditySimulation = async () => {

describe("simulation tests", async () => {
  const provider = anchor.AnchorProvider.local();
  provider.opts.commitment = "recent";
  anchor.setProvider(provider);

  let cloneProgramId: PublicKey = anchor.workspace.Clone.programId;
  let mockAssetFaucetProgramId: PublicKey =
    anchor.workspace.MockAssetFaucet.programId;

  if (process.env.SKIP_TESTS === "1") return;

  const mockUSDCMint = anchor.web3.Keypair.generate();
  const treasuryAddress = anchor.web3.Keypair.generate();
  const mockAssetMint = anchor.web3.Keypair.generate();
  const userAgentKp = anchor.web3.Keypair.generate();

  const userAgentProvider = new anchor.AnchorProvider(
    provider.connection,
    new anchor.Wallet(userAgentKp),
    { commitment: "recent" }
  );
  // Airdrop some SOL to the user.

  let userAgentUSDCAta: PublicKey;

  let cloneClient: CloneClient;
  let userAgentCloneClient: CloneClient;
  let usdcAssociatedTokenAccount;

  const [cloneAccountAddress, ___] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone")],
    cloneProgramId
  );
  let [faucetAddress, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet")],
    mockAssetFaucetProgramId
  );

  it("mock usdc initialized as faucet", async () => {
    await userAgentProvider.connection.requestAirdrop(
      userAgentProvider.wallet.publicKey,
      10000 * LAMPORTS_PER_SOL
    );

    await createTokenMint(provider, {
      mint: mockUSDCMint,
      scale: CONFIGURATION.usdcScale,
      authority: faucetAddress,
    });

    usdcAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider,
      mockUSDCMint.publicKey
    );
    await getOrCreateAssociatedTokenAccount(
      provider,
      mockUSDCMint.publicKey,
      treasuryAddress.publicKey
    );

    let tx = new Transaction().add(
      createInitializeInstruction({
        payer: provider.publicKey!,
        faucet: faucetAddress,
        mint: mockUSDCMint.publicKey,
      }),
      createMintAssetInstruction(
        {
          minter: provider.publicKey!,
          faucet: faucetAddress,
          mint: mockUSDCMint.publicKey,
          tokenAccount: usdcAssociatedTokenAccount.address,
        },
        {
          amount: toScale(
            CONFIGURATION.usdcMintAmount,
            CONFIGURATION.usdcScale
          ),
        }
      )
    );

    await provider.sendAndConfirm(tx);
  });

  it("mock asset initialized!", async () => {
    await createTokenMint(provider, { mint: mockAssetMint });

    let assetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider,
      mockAssetMint.publicKey
    );
    await provider.sendAndConfirm(
      new Transaction().add(
        createMintToCheckedInstruction(
          mockAssetMint.publicKey,
          assetAssociatedTokenAccount.address,
          provider.publicKey!,
          toScale(CONFIGURATION.assetMintAmount, CLONE_TOKEN_SCALE).toNumber(),
          CLONE_TOKEN_SCALE
        )
      )
    );
  });

  it("clone initialized!", async () => {
    await CloneClient.initializeClone(
      provider,
      cloneProgramId,
      CONFIGURATION.clone.cometCollateralIldLiquidatorFeeBps,
      CONFIGURATION.clone.cometOnassetIldLiquidatorFeeBps,
      CONFIGURATION.clone.borrowLiquidatorFeeBps,
      treasuryAddress.publicKey,
      mockUSDCMint.publicKey,
      0,
      95
    );
    let account = await CloneAccount.fromAccountAddress(
      provider.connection,
      cloneAccountAddress
    );
    cloneClient = new CloneClient(provider, account, cloneProgramId);
    userAgentCloneClient = new CloneClient(
      userAgentProvider,
      account,
      cloneProgramId
    );

    await cloneClient.updateCloneParameters({
      params: {
        __kind: "AddAuth",
        address: provider.publicKey,
      },
    });

    // CALCULATE SWAP EXECUTION
    const inputAmount = 1000;
    const swapResult = calculateSwapExecution(
      inputAmount,
      true,
      true,
      0,
      0,
      CONFIGURATION.comet.liquidityToAdd,
      fromScale(CONFIGURATION.pool.poolTradingFee, 4),
      fromScale(CONFIGURATION.pool.treasuryTradingFee, 4),
      CONFIGURATION.pool.initialPrice,
      cloneClient.clone.collateral
    );
    const finalPrice = inputAmount / swapResult.result;
    const slippage = finalPrice / CONFIGURATION.pool.initialPrice - 1;

    console.log(`${(slippage * 100).toFixed(2)}% slippage for ${inputAmount} USDC trade`);
  });

  it("initialize mock feeds and oracles", async () => {
    // Create Pyth Feeds to change price.
    let priceFeeds: PublicKey[] = [];

    for (let i = 0; i < 1 + CONFIGURATION.pool.nPools; i++) {
      let price = i === 0 ? 1 : CONFIGURATION.pool.initialPrice;
      const priceFeed = await createPriceFeed(
        provider,
        anchor.workspace.Pyth.programId,
        price,
        -8
      );
      priceFeeds.push(priceFeed);
    }

    const createOracleIx = (params: UpdateOraclesInstructionArgs) => {
      return createUpdateOraclesInstruction(
        {
          auth: cloneClient.provider.publicKey!,
          clone: cloneClient.cloneAddress,
          oracles: cloneClient.oraclesAddress,
        },
        params,
        cloneClient.programId
      );
    };
    let tx = new Transaction();

    priceFeeds.forEach((feed) => {
      tx.add(
        createOracleIx({
          params: {
            __kind: "Add",
            source: OracleSource.PYTH,
            address: feed,
            rescaleFactor: 0,
          },
        })
      );
    });

    await provider.sendAndConfirm(tx);
  });

  it("pools initialized!", async () => {
    for (let i = 1; i <= CONFIGURATION.pool.nPools; i++) {
      await cloneClient.addPool(
        CONFIGURATION.pool.minOvercollateralRatio,
        CONFIGURATION.pool.maxLiquidationOvercollateralRatio,
        CONFIGURATION.pool.poolTradingFee,
        CONFIGURATION.pool.treasuryTradingFee,
        CONFIGURATION.pool.ilHealthScoreCoefficient,
        CONFIGURATION.pool.positionHealthScoreCoefficient,
        i,
        mockAssetMint.publicKey
      );
    }
  });

  it("user(s) initialized + add collateral!", async () => {
    let ix = cloneClient.addCollateralToCometInstruction(
      usdcAssociatedTokenAccount.address,
      toScale(CONFIGURATION.comet.collateralToAdd, CONFIGURATION.usdcScale)
    );

    let tx = new Transaction().add(cloneClient.initializeUserInstruction(), ix);

    await provider.sendAndConfirm(tx);

    // Initialize second user.
    if (CONFIGURATION.simulation.externalLPShare > 0) {
      // Create a second user.
      userAgentUSDCAta = await getAssociatedTokenAddress(
        mockUSDCMint.publicKey,
        userAgentKp.publicKey,
        false
      );

      const ratio =
        CONFIGURATION.simulation.externalLPShare /
        (1 - CONFIGURATION.simulation.externalLPShare);
      const collateralCoeff = fromScale(
        cloneClient.clone.collateral.collateralizationRatio,
        2
      );
      const positionCoeff = fromScale(
        CONFIGURATION.pool.positionHealthScoreCoefficient,
        2
      );

      let externalLiquidityPerPool = ratio * CONFIGURATION.comet.liquidityToAdd;
      const targetCollateral =
        (positionCoeff * externalLiquidityPerPool * CONFIGURATION.pool.nPools) /
        (collateralCoeff *
          (100 - CONFIGURATION.simulation.externalLPHealthScore));
      const usdcCollateralToAdd = toScale(targetCollateral, CONFIGURATION.usdcScale);

      let tx = new Transaction().add(
        // Create ata for mockUSDC
        createAssociatedTokenAccountInstruction(
          userAgentProvider.publicKey,
          userAgentUSDCAta,
          userAgentKp.publicKey,
          mockUSDCMint.publicKey
        ),
        // Mint mockUSDC to ata
        createMintAssetInstruction(
          {
            minter: userAgentProvider.publicKey!,
            faucet: faucetAddress,
            mint: mockUSDCMint.publicKey,
            tokenAccount: userAgentUSDCAta,
          },
          {
            amount: usdcCollateralToAdd,
          }
        ),
        userAgentCloneClient.initializeUserInstruction(),
        userAgentCloneClient.addCollateralToCometInstruction(
          userAgentUSDCAta,
          usdcCollateralToAdd
        )
      );

      await userAgentProvider.sendAndConfirm(tx);
    }
  });

  it("comet liquidity added!", async () => {
    const collateral = cloneClient.clone.collateral;
    let oracles = await cloneClient.getOracles();

    let tx = new Transaction().add(
      cloneClient.updatePricesInstruction(oracles)
    );

    for (let i = 0; i < CONFIGURATION.pool.nPools; i++) {
      tx.add(
        cloneClient.addLiquidityToCometInstruction(
          toScale(CONFIGURATION.comet.liquidityToAdd, collateral.scale),
          i
        )
      );
    }
    await provider.sendAndConfirm(tx);

    const user = await cloneClient.getUserAccount();
    const pools = await cloneClient.getPools();
    oracles = await cloneClient.getOracles();

    const { healthScore, effectiveCollateralValue } = getHealthScore(
      oracles,
      pools,
      user.comet,
      cloneClient.clone.collateral
    );

    console.log(
      "Starting HEALTH SCORE (main):",
      healthScore,
      effectiveCollateralValue
    );

    if (CONFIGURATION.simulation.externalLPShare > 0) {
      tx = new Transaction().add(
        userAgentCloneClient.updatePricesInstruction(oracles)
      );
      const share = CONFIGURATION.simulation.externalLPShare;
      const amountToProvide =
        (share * CONFIGURATION.comet.liquidityToAdd) / (1 - share);

      for (let i = 0; i < CONFIGURATION.pool.nPools; i++) {
        tx.add(
          userAgentCloneClient.addLiquidityToCometInstruction(
            toScale(amountToProvide, collateral.scale),
            i
          )
        );
      }
      await userAgentProvider.sendAndConfirm(tx);

      const user = await userAgentCloneClient.getUserAccount();
      const { healthScore, effectiveCollateralValue } = getHealthScore(
        oracles,
        pools,
        user.comet,
        cloneClient.clone.collateral
      );
      console.log(
        "Starting HEALTH SCORE (user):",
        healthScore,
        effectiveCollateralValue
      );
    }
  });

  it("market conditions simulation", async () => {
    const amountToBuy = (poolAmount: number) => {
      const gamma =
        (1 + CONFIGURATION.simulation.arbitragePoolPremium) *
        (1 + CONFIGURATION.simulation.marketRise);
      return (Math.sqrt(gamma) - 1) * poolAmount;
    };
    const oracles = await cloneClient.getOracles();
    let pools = await cloneClient.getPools();

    const usdcAta = await getAssociatedTokenAddress(
      cloneClient.clone.collateral.mint,
      provider.wallet.publicKey
    );
    const usdcTreasuryAta = await getAssociatedTokenAddress(
      cloneClient.clone.collateral.mint,
      treasuryAddress.publicKey
    );

    let tx = new Transaction();
    let onassetAddresses: PublicKey[] = [];
    let onassetTreasuryAddresses: PublicKey[] = [];
    pools.pools.forEach(async (pool, i) => {
      const onAssetAta = await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        provider.wallet.publicKey
      );
      onassetAddresses.push(onAssetAta);
      const onAssetTreasuryAta = await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        treasuryAddress.publicKey
      );
      onassetTreasuryAddresses.push(onAssetTreasuryAta);

      tx.add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey,
          onAssetAta,
          provider.wallet.publicKey,
          pool.assetInfo.onassetMint
        ),
        createAssociatedTokenAccountInstruction(
          provider.publicKey,
          onAssetTreasuryAta,
          treasuryAddress.publicKey,
          pool.assetInfo.onassetMint
        )
      );
    });
    await provider.sendAndConfirm(tx);

    tx = new Transaction().add(cloneClient.updatePricesInstruction(oracles));

    let poolPrices: number[] = [];

    pools.pools.forEach(async (pool, i) => {
      const oraclePrice = fromScale(
        oracles.oracles[pool.assetInfo.oracleInfoIndex].price,
        oracles.oracles[pool.assetInfo.oracleInfoIndex].expo
      );
      const { poolOnasset, poolCollateral } = calculatePoolAmounts(
        fromScale(pool.collateralIld, cloneClient.clone.collateral.scale),
        fromCloneScale(pool.onassetIld),
        fromScale(
          pool.committedCollateralLiquidity,
          cloneClient.clone.collateral.scale
        ),
        oraclePrice,
        cloneClient.clone.collateral
      );
      const buyAmount = amountToBuy(poolOnasset);

      const executionEst = calculateExecutionThresholdFromParams(
        buyAmount,
        true,
        poolCollateral,
        poolOnasset,
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(pool.liquidityTradingFeeBps, 4),
        0.001
      );
      poolPrices.push(poolCollateral / poolOnasset);

      tx.add(
        cloneClient.swapInstruction(
          i,
          toCloneScale(buyAmount),
          false,
          false,
          toCloneScale(executionEst.onusdThresholdAmount),
          pool.assetInfo.onassetMint,
          usdcAta,
          onassetAddresses[i],
          usdcTreasuryAta,
          onassetTreasuryAddresses[i]
        )
      );
    });

    await provider.sendAndConfirm(tx);
    // Check pool prices
    pools = await cloneClient.getPools();
    pools.pools.forEach((pool, i) => {
      const oraclePrice = fromScale(
        oracles.oracles[pool.assetInfo.oracleInfoIndex].price,
        oracles.oracles[pool.assetInfo.oracleInfoIndex].expo
      );
      const { poolOnasset, poolCollateral } = calculatePoolAmounts(
        fromScale(pool.collateralIld, cloneClient.clone.collateral.scale),
        fromCloneScale(pool.onassetIld),
        fromScale(
          pool.committedCollateralLiquidity,
          cloneClient.clone.collateral.scale
        ),
        oraclePrice,
        cloneClient.clone.collateral
      );
      assert.isAbove(
        poolCollateral / poolOnasset,
        poolPrices[i],
        "pool price should have increased"
      );
    });
  });

  it("oracle price increases", async () => {
    let tx = new Transaction();

    let oracles = await cloneClient.getOracles();

    const desiredPrice =
      CONFIGURATION.pool.initialPrice *
      (1 + CONFIGURATION.simulation.marketRise);

    oracles.oracles.forEach((oracle, i) => {
      if (i === 0) return;
      tx.add(
        createSetPriceInstruction(
          {
            priceAccount: oracle.address,
          },
          {
            price: toScale(desiredPrice, 8),
          }
        )
      );
    });
    tx.add(cloneClient.updatePricesInstruction(oracles));
    await provider.sendAndConfirm(tx);

    oracles = await cloneClient.getOracles();

    oracles.oracles.forEach((oracle, i) => {
      if (i === 0) return;
      const oraclePrice = fromScale(oracle.price, oracle.expo);
      assert.closeTo(
        oraclePrice,
        desiredPrice,
        0.1,
        "oracle price should have increased"
      );
    });
  });

  it("Check health score", async () => {
    const oracles = await cloneClient.getOracles();
    const user = await cloneClient.getUserAccount();
    const pools = await cloneClient.getPools();

    const { healthScore, effectiveCollateralValue } = getHealthScore(
      oracles,
      pools,
      user.comet,
      cloneClient.clone.collateral
    );

    console.log(
      "FINAL HEALTH SCORE (main):",
      healthScore,
      effectiveCollateralValue
    );
    if (CONFIGURATION.simulation.externalLPShare > 0) {
      const userAgentUser = await userAgentCloneClient.getUserAccount();
      const { healthScore, effectiveCollateralValue } = getHealthScore(
        oracles,
        pools,
        userAgentUser.comet,
        cloneClient.clone.collateral
      );
      console.log(
        "FINAL HEALTH SCORE (user):",
        healthScore,
        effectiveCollateralValue
      );
    }
  });

  it("Attempt liquidation attack", async () => {
    const oracles = await cloneClient.getOracles();
    let user = await cloneClient.getUserAccount();
    let pools = await cloneClient.getPools();

    const { attackPotentials, profitableAttack } = calculateLiquidationAttacks(
      user.comet,
      cloneClient.clone,
      pools,
      oracles
    );
    const positionIndex = profitableAttack !== -1 ? profitableAttack : 0;
    const atkPotential = attackPotentials[positionIndex];

    if (atkPotential.costToAttack === undefined) {
      console.log("Insufficient pool liquidity to attack...");
      return;
    }
    if (atkPotential.costToAttack <= 0) {
      console.log("No need to attack... health score below zero.");
      return;
    }

    console.log("ATTACK POTENTIAL:", atkPotential);

    const position = user.comet.positions[positionIndex];
    const poolIndex = position.poolIndex;

    const pool = pools.pools[poolIndex];
    const oraclePrice = fromScale(
      oracles.oracles[pool.assetInfo.oracleInfoIndex].price,
      oracles.oracles[pool.assetInfo.oracleInfoIndex].expo
    );
    const { poolOnasset, poolCollateral } = calculatePoolAmounts(
      fromScale(pool.collateralIld, cloneClient.clone.collateral.scale),
      fromCloneScale(pool.onassetIld),
      fromScale(
        pool.committedCollateralLiquidity,
        cloneClient.clone.collateral.scale
      ),
      oraclePrice,
      cloneClient.clone.collateral
    );
    const amountToBuy = atkPotential.amountToBuy;
    const totalILDToLiq = atkPotential.totalProjectedILD;
    const executionEst = calculateExecutionThresholdFromParams(
      amountToBuy,
      true,
      poolCollateral,
      poolOnasset,
      fromScale(pool.treasuryTradingFeeBps, 4),
      fromScale(pool.liquidityTradingFeeBps, 4),
      0.001
    );
    const onassetAta = await getAssociatedTokenAddress(
      pool.assetInfo.onassetMint,
      provider.wallet.publicKey
    );
    const treasuryOnassetAta = await getAssociatedTokenAddress(
      pool.assetInfo.onassetMint,
      treasuryAddress.publicKey
    );
    const treasuryUsdcAta = await getAssociatedTokenAddress(
      cloneClient.clone.collateral.mint,
      treasuryAddress.publicKey
    );

    const startingUSDCBalance = fromScale(
      (
        await getAccount(
          provider.connection,
          usdcAssociatedTokenAccount.address
        )
      ).amount,
      cloneClient.clone.collateral.scale
    );
    // Attempt to buy an absurd amount of onasset to put the comet at risk of liquidation.
    const tx = new Transaction().add(
      cloneClient.updatePricesInstruction(oracles),
      cloneClient.swapInstruction(
        poolIndex,
        toCloneScale(amountToBuy),
        false,
        false,
        toCloneScale(executionEst.onusdThresholdAmount),
        pool.assetInfo.onassetMint,
        usdcAssociatedTokenAccount.address,
        onassetAta,
        treasuryUsdcAta,
        treasuryOnassetAta
      ),
      cloneClient.liquidateCometOnassetILDInstruction(
        pools,
        user,
        provider.wallet.publicKey!,
        0,
        usdcAssociatedTokenAccount.address,
        onassetAta,
        toCloneScale(totalILDToLiq)
      )
    );

    await provider.sendAndConfirm(tx);
    const endingUSDCBalance = fromScale(
      (
        await getAccount(
          provider.connection,
          usdcAssociatedTokenAccount.address
        )
      ).amount,
      cloneClient.clone.collateral.scale
    );
    const expectedEndingUSDCBalance =
      startingUSDCBalance -
      executionEst.expectedOnusdAmount +
      atkPotential.liquidationReward;

    assert.isBelow(
      Math.abs(endingUSDCBalance - expectedEndingUSDCBalance) /
        endingUSDCBalance,
      0.01,
      "ending USDC balance should be close to expected ending USDC balance"
    );

    const shouldAttackWork =
      atkPotential.liquidationReward > atkPotential.costToAttack;
    const assertCmp = shouldAttackWork ? assert.isAbove : assert.isAtMost;
    assertCmp(
      endingUSDCBalance,
      startingUSDCBalance,
      "ending/starting USDC balances were unexpected"
    );

    console.log(
      shouldAttackWork
        ? "LIQUIDATION ATTACK SUCCESSFUL"
        : "LIQUIDATION ATTACK NOT SUCCESSFUL"
    );
  });
});
};
