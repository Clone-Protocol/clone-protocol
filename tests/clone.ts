import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
} from "@solana/spl-token";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  CLONE_TOKEN_SCALE,
  CloneClient,
  fromCloneScale,
  fromScale,
  toCloneScale,
  toScale,
} from "../sdk/src/clone";
import { createPriceFeed, setPrice, getFeedData } from "../sdk/src/oracle";
import {
  calculateSwapExecution,
  sleep,
  getOrCreateAssociatedTokenAccount,
} from "../sdk/src/utils";
import { getHealthScore, getILD } from "../sdk/src/healthscore";
import {
  Clone as CloneAccount,
  createUpdatePoolParametersInstruction,
} from "../sdk/generated/clone";
import {
  Jupiter,
  createCreateAssetInstruction,
  createInitializeInstruction,
  createMintAssetInstruction,
  createMintUsdcInstruction,
  createSwapInstruction,
} from "../sdk/generated/jupiter-agg-mock";
import * as CloneStaking from "../sdk/generated/clone-staking";

const CLONE_SCALE_CONVERSION = Math.pow(10, -CLONE_TOKEN_SCALE);
const USDC_SCALE_CONVERSION = Math.pow(10, -7);

describe("tests", async () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  let walletPubkey = provider.publicKey!;

  let cloneProgramId = anchor.workspace.Clone.programId;
  let pythProgramId = anchor.workspace.Pyth.programId;
  let jupiterProgramId = anchor.workspace.JupiterAggMock.programId;
  let cloneStakingProgramId = anchor.workspace.CloneStaking.programId;

  const onusdMint = anchor.web3.Keypair.generate();
  const mockUSDCMint = anchor.web3.Keypair.generate();
  const treasuryAddress = anchor.web3.Keypair.generate();
  const clnTokenMint = anchor.web3.Keypair.generate();
  let treasuryOnusdTokenAccount;
  let treasuryOnassetTokenAccount;

  const healthScoreCoefficient = 1.059;
  const ilHealthScoreCoefficient = 128.288;
  const liquidatorFee = 500; // in bps
  const poolTradingFee = 200;
  const treasuryTradingFee = 100;
  const tier0 = {
    minStakeRequirement: new BN(1000),
    lpTradingFeeBps: 15,
    treasuryTradingFeeBps: 10,
  };

  let priceFeed: PublicKey;
  let mockUSDCTokenAccountInfo;
  let onusdTokenAccountInfo;
  let onassetTokenAccountInfo;
  let cloneClient: CloneClient;

  const [cloneAccountAddress, ___] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone")],
    cloneProgramId
  );
  const mockAssetMint = anchor.web3.Keypair.generate();
  let [jupiterAddress, _jupiterNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("jupiter")],
    jupiterProgramId
  );

  const [cloneStakingAddress, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone-staking")],
    cloneStakingProgramId
  );
  const clnTokenVault = await getAssociatedTokenAddress(
    clnTokenMint.publicKey,
    cloneStakingAddress,
    true
  );
  const userClnTokenAddress = await getAssociatedTokenAddress(
    clnTokenMint.publicKey,
    walletPubkey
  );
  const [userStakingAddress, __] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), walletPubkey.toBuffer()],
    cloneStakingProgramId
  );

  it("to scale test", () => {
    assert.isTrue(toCloneScale(28.15561224).toString() === "2815561224");
    assert.isTrue(toCloneScale(28.15561224999).toString() === "2815561224");
    assert.isTrue(toCloneScale(28.1556).toString() === "2815560000");
    assert.isTrue(toCloneScale(2815561224).toString() === "281556122400000000");
    assert.isTrue(toCloneScale(0.2815561224).toString() === "28155612");
    assert.isTrue(toCloneScale(28.05561224).toString() === "2805561224");
  });

  it("initialize staking program + initialize tier + add stake", async () => {
    let tx = new Transaction().add(
      // create cln mint account
      SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: clnTokenMint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
        programId: TOKEN_PROGRAM_ID,
      }),
      // init clone mint account
      createInitializeMintInstruction(
        clnTokenMint.publicKey,
        CLONE_TOKEN_SCALE,
        walletPubkey,
        null
      )
    );
    await provider.sendAndConfirm(tx, [clnTokenMint]);

    // let ix = createAssociatedTokenAccountInstruction(
    //   provider.publicKey!,
    //   clnTokenVault,
    //   cloneStakingAddress,
    //   clnTokenMint.publicKey
    // );

    tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        provider.publicKey!,
        clnTokenVault,
        cloneStakingAddress,
        clnTokenMint.publicKey
      ),
      CloneStaking.createInitializeInstruction(
        {
          admin: provider.publicKey!,
          cloneStaking: cloneStakingAddress,
          clnTokenMint: clnTokenMint.publicKey,
          clnTokenVault: clnTokenVault,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        {
          stakingPeriodSlots: new BN(24),
        }
      ),
      CloneStaking.createUpdateStakingParamsInstruction(
        {
          admin: provider.publicKey!,
          cloneStaking: cloneStakingAddress,
        },
        {
          params: {
            __kind: "Tier",
            numTiers: 1,
            index: 0,
            stakeRequirement: tier0.minStakeRequirement,
            lpTradingFeeBps: tier0.lpTradingFeeBps,
            treasuryTradingFeeBps: tier0.treasuryTradingFeeBps,
          },
        }
      )
    );
    await provider.sendAndConfirm(tx);

    // Mint cln tokens to user.
    let mintTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        walletPubkey,
        userClnTokenAddress,
        walletPubkey,
        clnTokenMint.publicKey
      ),
      createMintToCheckedInstruction(
        clnTokenMint.publicKey,
        userClnTokenAddress,
        walletPubkey,
        tier0.minStakeRequirement.toNumber(),
        CLONE_TOKEN_SCALE
      ),
      CloneStaking.createAddStakeInstruction(
        {
          user: provider.publicKey!,
          userAccount: userStakingAddress,
          cloneStaking: cloneStakingAddress,
          clnTokenMint: clnTokenMint.publicKey,
          clnTokenVault: clnTokenVault,
          userClnTokenAccount: userClnTokenAddress,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        {
          amount: tier0.minStakeRequirement,
        }
      )
    );

    await provider.sendAndConfirm(mintTx);

    let userStakingAccount = await CloneStaking.User.fromAccountAddress(
      provider.connection,
      userStakingAddress
    );
    assert.equal(
      Number(userStakingAccount.stakedTokens),
      tier0.minStakeRequirement.toNumber()
    );
  });

  it("mock jupiter agg initialized + mock usdc initialized + mock asset initialized!", async () => {
    await provider.sendAndConfirm(
      new Transaction().add(
        createInitializeInstruction({
          admin: provider.publicKey!,
          jupiterAccount: jupiterAddress,
          usdcMint: mockUSDCMint.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
      ),
      [mockUSDCMint]
    );
  });

  it("clone initialized!", async () => {
    let tx = new Transaction().add(
      // create onusd mint account
      SystemProgram.createAccount({
        fromPubkey: walletPubkey,
        newAccountPubkey: onusdMint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
        programId: TOKEN_PROGRAM_ID,
      }),
      // init clone mint account
      createInitializeMintInstruction(
        onusdMint.publicKey,
        CLONE_TOKEN_SCALE,
        cloneAccountAddress,
        null
      )
    );
    await provider.sendAndConfirm(tx, [onusdMint]);
    await CloneClient.initializeClone(
      provider,
      cloneProgramId,
      liquidatorFee,
      liquidatorFee,
      treasuryAddress.publicKey,
      mockUSDCMint.publicKey,
      onusdMint.publicKey
    );
    let account = await CloneAccount.fromAccountAddress(
      provider.connection,
      cloneAccountAddress
    );
    cloneClient = new CloneClient(provider, account, cloneProgramId);
  });

  it("add onusd and usdc collaterals", async () => {
    await cloneClient.addCollateral(onusdMint.publicKey, 100);

    await cloneClient.addCollateral(mockUSDCMint.publicKey, 100);

    let tokenData = await cloneClient.getTokenData();
    assert.equal(Number(tokenData.numCollaterals), 2);
  });

  it("user initialized!", async () => {
    let tx = new Transaction().add(cloneClient.initializeUserInstruction());

    await cloneClient.provider.sendAndConfirm!(tx);
  });

  it("change feed price + mock asset created", async () => {
    let price = 10;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    priceFeed = await createPriceFeed(
      provider,
      pythProgramId,
      price,
      expo,
      conf
    );
    let currentPrice = (await getFeedData(provider, priceFeed)).aggregate.price;
    assert.equal(currentPrice, price, "check initial price");

    price = 5;
    await setPrice(provider, price, priceFeed);
    let updatedPrice = (await getFeedData(provider, priceFeed)).aggregate.price;
    assert.equal(updatedPrice, price, "check updated price");

    await provider.sendAndConfirm(
      new Transaction().add(
        createCreateAssetInstruction(
          {
            payer: provider.publicKey!,
            assetMint: mockAssetMint.publicKey,
            jupiterAccount: jupiterAddress,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          { pythOracle: priceFeed }
        )
      ),
      [mockAssetMint]
    );

    await cloneClient.addOracleInfo(priceFeed);
  });

  it("pool initialized!", async () => {
    const jupiterData = await Jupiter.fromAccountAddress(
      provider.connection,
      jupiterAddress
    );

    await cloneClient.initializePool(
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      ilHealthScoreCoefficient,
      healthScoreCoefficient,
      0,
      jupiterData.assetMints[0]
    );

    let tokenData = await cloneClient.getTokenData();
    assert.equal(Number(tokenData.numPools), 1);
  });
  it("non-stable mock asset added as a collateral!", async () => {
    await cloneClient.addCollateral(mockAssetMint.publicKey, 200, 0);

    let tokenData = await cloneClient.getTokenData();
    assert.equal(Number(tokenData.numCollaterals), 3);
  });

  it("token data initialization check", async () => {
    let tokenData = await cloneClient.getTokenData();
    const oracle = tokenData.oracles[0];

    assert.equal(Number(tokenData.numPools), 1, "num pools incorrect");
    assert.equal(
      Number(tokenData.numCollaterals),
      3,
      "num collaterals incorrect"
    );

    const first_pool = tokenData.pools[0];
    assert(
      !first_pool.underlyingAssetTokenAccount.equals(
        anchor.web3.PublicKey.default
      ),
      "check underlyingAssetTokenAccount"
    );
    const assetInfo = first_pool.assetInfo;

    assert(oracle.pythAddress.equals(priceFeed), "check price feed");

    assert.equal(
      fromScale(assetInfo.minOvercollateralRatio, 2),
      1.5,
      "overcollateral ratio incorrect"
    );

    assert.equal(
      fromScale(assetInfo.maxLiquidationOvercollateralRatio, 2),
      2,
      "max liquidation overcollateral ratio incorrect"
    );

    const first_collateral = tokenData.collaterals[1];
    assert(
      !first_collateral.mint.equals(anchor.web3.PublicKey.default),
      "check mint address"
    );
    assert(!first_collateral.vault.equals(anchor.web3.PublicKey.default)),
      "check vault address";
  });

  it("price updated!", async () => {
    let tokenData = await cloneClient.getTokenData();
    let ix = cloneClient.updatePricesInstruction(tokenData);
    await provider.sendAndConfirm(new Transaction().add(ix));
  });

  it("mock usdc minted!", async () => {
    const usdcMintAmount = new BN("10000000000000000");
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    let ix = createMintUsdcInstruction(
      {
        usdcMint: mockUSDCMint.publicKey,
        usdcTokenAccount: mockUSDCTokenAccountInfo.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount: usdcMintAmount,
      }
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      1000000000,
      "check USDC amount"
    );
  });

  it("onusd minted!", async () => {
    let tokenData = await cloneClient.getTokenData();
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    const mintAmount = 1000000;
    const USDC_SCALE = 7;
    let ix = cloneClient.mintOnusdInstruction(
      tokenData,
      toCloneScale(mintAmount),
      onusdTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    const startingAmount =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -USDC_SCALE);

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    const endingAmount =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -USDC_SCALE);

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      mintAmount,
      "check onusd token amount"
    );
    assert.equal(
      startingAmount - endingAmount,
      mintAmount,
      "check USDC amount"
    );

    tokenData = await cloneClient.getTokenData();

    const vault = await provider.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 1000000, "check usdc vault amount");
  });

  it("mint mock asset", async () => {
    let assetMintAmount = 1000;

    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockAssetMint.publicKey
      );

    await provider.sendAndConfirm(
      new Transaction().add(
        createMintAssetInstruction(
          {
            assetMint: mockAssetMint.publicKey,
            assetTokenAccount: mockAssetAssociatedTokenAddress.address,
            jupiterAccount: jupiterAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          {
            assetIndex: 0,
            amount: new BN(assetMintAmount * 100000000),
          }
        )
      )
    );

    mockAssetAssociatedTokenAddress = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockAssetMint.publicKey
    );

    assert.equal(
      Number(mockAssetAssociatedTokenAddress.amount) / 100000000,
      assetMintAmount
    );
  });

  it("jupiter USDC mint -> wrap for onUSD", async () => {
    let tokenData = await cloneClient.getTokenData();

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const currentOnUSD =
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;

    jupiterAccount = await Jupiter.fromAccountAddress(
      provider.connection,
      jupiterAddress
    );
    let usdcMint = jupiterAccount.usdcMint;

    usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      jupiterAccount.usdcMint,
      provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let onUSDtoMint = 5000000;
    let ixUsdcMint = createMintUsdcInstruction(
      {
        usdcMint: usdcMint,
        usdcTokenAccount: usdcAssociatedTokenAddress,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount: toScale(onUSDtoMint, 7),
      }
    );

    let wrapIx = cloneClient.mintOnusdInstruction(
      tokenData,
      toCloneScale(onUSDtoMint),
      onusdTokenAccountInfo.address,
      usdcAssociatedTokenAddress
    );
    await provider.sendAndConfirm(
      new Transaction().add(ixUsdcMint).add(wrapIx)
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      currentOnUSD + onUSDtoMint,
      "onusd not minted properly!"
    );
  });

  let assetMint;
  let jupiterAccount;
  let assetAssociatedTokenAddress;
  let usdcAssociatedTokenAddress;

  it("mint USDC and swap for some mock asset", async () => {
    jupiterAccount = await Jupiter.fromAccountAddress(
      provider.connection,
      jupiterAddress
    );
    assetMint = jupiterAccount.assetMints[0];
    let usdcMint = jupiterAccount.usdcMint;
    assetAssociatedTokenAddress = await getAssociatedTokenAddress(
      assetMint,
      provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      jupiterAccount.usdcMint,
      provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let ixUsdcMint = createMintUsdcInstruction(
      {
        usdcMint: usdcMint,
        usdcTokenAccount: usdcAssociatedTokenAddress,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount: new BN(10000 * 10000000),
      }
    );
    let ixSwap = createSwapInstruction(
      {
        user: provider.publicKey!,
        jupiterAccount: jupiterAddress,
        assetMint: assetMint,
        usdcMint: usdcMint,
        userAssetTokenAccount: assetAssociatedTokenAddress,
        userUsdcTokenAccount: usdcAssociatedTokenAddress,
        pythOracle: jupiterAccount.oracles[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        assetIndex: 0,
        isAmountInput: false,
        isAmountAsset: true,
        amount: toCloneScale(10),
      }
    );

    await provider.sendAndConfirm(new Transaction().add(ixUsdcMint, ixSwap));
  });
  let mintAmount = 200000;
  let usdctoDeposit = 20000000;

  it("onasset borrowed!", async () => {
    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[0];

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const startingOnAsset =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    const startingMockUSDC =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -7);

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    let ix = cloneClient.initializeBorrowPositionInstruction(
      tokenData,
      mockUSDCTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      toCloneScale(mintAmount),
      toScale(usdctoDeposit, 7),
      0,
      1
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[0];

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnAsset + mintAmount,
      "check onasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) * USDC_SCALE_CONVERSION,
      startingMockUSDC - usdctoDeposit,
      "check USDC amount"
    );

    let vault = await provider.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 26000000, "check usdc vault amount");

    let userAccount = await cloneClient.getUserAccount();

    const borrowPosition = userAccount.borrows.positions[0];

    assert.equal(
      fromCloneScale(borrowPosition.borrowedOnasset),
      mintAmount,
      "stored minted amount"
    );
    assert.equal(
      fromScale(borrowPosition.collateralAmount, 7),
      usdctoDeposit,
      "stored collateral amount"
    );
  });

  it("full withdraw and close borrow position!", async () => {
    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[0];
    let vault = await provider.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    const startingVaultAmount = vault.value.uiAmount!;
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    const startingUsdcAmount =
      Number(mockUSDCTokenAccountInfo.amount) * USDC_SCALE_CONVERSION;
    let borrowIndex = 0;
    let userAccount = await cloneClient.getUserAccount();
    let borrowPosition = userAccount.borrows.positions[borrowIndex];
    let collateral =
      tokenData.collaterals[Number(borrowPosition.collateralIndex)];

    const collateralWithdrawal = fromScale(
      borrowPosition.collateralAmount,
      collateral.scale
    );
    const payBorrowDebtIx = cloneClient.payBorrowDebtInstruction(
      tokenData,
      userAccount,
      onassetTokenAccountInfo.address,
      new BN(borrowPosition.borrowedOnasset),
      borrowIndex
    );

    const withdrawCollateralFromBorrowIx =
      cloneClient.withdrawCollateralFromBorrowInstruction(
        tokenData,
        userAccount,
        borrowIndex,
        mockUSDCTokenAccountInfo.address,
        new BN(borrowPosition.collateralAmount)
      );

    const updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    let tx = new Transaction();
    tx.add(updatePricesIx)
      .add(payBorrowDebtIx)
      .add(withdrawCollateralFromBorrowIx);

    await provider.sendAndConfirm(tx);

    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[0];

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount),
      0,
      "check onasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) * USDC_SCALE_CONVERSION,
      startingUsdcAmount +
        fromScale(borrowPosition.collateralAmount, collateral.scale),
      "check USDC amount"
    );

    vault = await provider.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );

    assert.equal(
      vault.value!.uiAmount,
      startingVaultAmount - collateralWithdrawal,
      "check usdc vault amount"
    );

    // Recreate original position.
    let ix = cloneClient.initializeBorrowPositionInstruction(
      tokenData,
      mockUSDCTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      toCloneScale(mintAmount),
      toScale(usdctoDeposit, 7),
      0,
      1
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );
  });

  it("mint collateral added!", async () => {
    let tokenData = await cloneClient.getTokenData();
    let userAccount = await cloneClient.getUserAccount();
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    const startingUsdcAmount =
      Number(mockUSDCTokenAccountInfo.amount) * USDC_SCALE_CONVERSION;
    let additionalCollateral = 100;

    let ix = cloneClient.addCollateralToBorrowInstruction(
      tokenData,
      userAccount,
      0,
      mockUSDCTokenAccountInfo.address,
      toScale(additionalCollateral, 7)
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[0];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) * USDC_SCALE_CONVERSION,
      startingUsdcAmount - additionalCollateral,
      "check USDC amount"
    );
  });

  it("more onasset minted!", async () => {
    const tokenData = await cloneClient.getTokenData();
    const userAccount = await cloneClient.getUserAccount();

    const pool = tokenData.pools[0];
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const startingBalance =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);
    let moreToBorrow = 0.05;

    let ix = cloneClient.borrowMoreInstruction(
      tokenData,
      userAccount,
      onassetTokenAccountInfo.address,
      toCloneScale(moreToBorrow),
      0
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingBalance + moreToBorrow,
      1e-8,
      "check user onasset balance"
    );
  });

  it("comet collateral added!", async () => {
    const collateralToAdd = 100000;
    let userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;
    const tokenData = await cloneClient.getTokenData();
    const collateral = tokenData.collaterals[0];
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    const startingOnusdWallet = fromCloneScale(onusdTokenAccountInfo.amount);
    let vault = await provider.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    const startingVaultBalance = vault.value!.uiAmount;

    let ix = cloneClient.addCollateralToCometInstruction(
      tokenData,
      onusdTokenAccountInfo.address,
      toCloneScale(collateralToAdd),
      0
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const endingOnusdWallet = fromCloneScale(onusdTokenAccountInfo.amount);

    assert.equal(
      startingOnusdWallet - endingOnusdWallet,
      collateralToAdd,
      "check user onUSD"
    );

    vault = await provider.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(
      vault.value.uiAmount! - startingVaultBalance!,
      collateralToAdd,
      "check vault balance"
    );

    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockAssetMint.publicKey
      );

    const nonStableCollateral = tokenData.collaterals[2];

    // Add non-stable collateral
    ix = cloneClient.addCollateralToCometInstruction(
      tokenData,
      mockAssetAssociatedTokenAddress.address,
      toCloneScale(100),
      2
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    const nonStableVault = await provider.connection.getTokenAccountBalance(
      nonStableCollateral.vault,
      "recent"
    );

    assert.equal(
      nonStableVault.value!.uiAmount,
      100,
      "check non-stable vault balance"
    );

    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;

    assert.equal(Number(comet.numCollaterals), 2, "check num collaterals");
  });

  it("comet collateral withdrawn!", async () => {
    let userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;
    let tokenData = await cloneClient.getTokenData();
    const collateral = tokenData.collaterals[0];

    let vault = await provider.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const startingOnusdWallet = fromCloneScale(onusdTokenAccountInfo.amount);
    const collateralToWithdraw = 10000;
    const startingVaultBalance = vault.value.uiAmount!;

    let ix = cloneClient.withdrawCollateralFromCometInstruction(
      tokenData,
      userAccount,
      onusdTokenAccountInfo.address,
      toCloneScale(collateralToWithdraw),
      0
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    vault = await provider.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const endingOnusdWallet = fromCloneScale(onusdTokenAccountInfo.amount);

    assert.equal(
      endingOnusdWallet - startingOnusdWallet,
      collateralToWithdraw,
      "check user onUSD"
    );

    assert.equal(
      startingVaultBalance - vault.value!.uiAmount!,
      collateralToWithdraw,
      "check vault balance"
    );
    assert.equal(Number(comet.numCollaterals), 2, "check num collaterals");
  });

  it("comet liquidity added!", async () => {
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let tokenData = await cloneClient.getTokenData();
    const initialPool = tokenData.pools[0];
    const liquidityToAdd = 1000000;

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    let ix = cloneClient.addLiquidityToCometInstruction(
      toCloneScale(liquidityToAdd),
      0
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    tokenData = await cloneClient.getTokenData();
    const finalPool = tokenData.pools[0];

    assert.closeTo(
      fromCloneScale(finalPool.committedOnusdLiquidity) -
        fromCloneScale(initialPool.committedOnusdLiquidity),
      liquidityToAdd,
      1e-6,
      "check lp supply pool balance"
    );
  });

  it("comet health check", async () => {
    let userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;
    let tokenData = await cloneClient.getTokenData();
    let healthScore = getHealthScore(tokenData, comet);

    assert.closeTo(healthScore.healthScore, 88, 1, "check health score.");

    await cloneClient.updatePoolParameters({
      index: 0,
      params: {
        __kind: "PositionHealthScoreCoefficient",
        value: toCloneScale(healthScoreCoefficient * 2),
      },
    });
    await cloneClient.updatePoolParameters({
      index: 0,
      params: {
        __kind: "IlHealthScoreCoefficient",
        value: toCloneScale(ilHealthScoreCoefficient * 2),
      },
    });

    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;
    tokenData = await cloneClient.getTokenData();

    healthScore = getHealthScore(tokenData, comet);
    assert.closeTo(healthScore.healthScore, 76, 1, "check health score.");
  });

  it("comet liquidity withdrawn!", async () => {
    const tokenData = await cloneClient.getTokenData();
    let userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;
    const positionIndex = 0;
    let position = comet.positions[positionIndex];
    const poolIndex = Number(position.poolIndex);
    const pool = tokenData.pools[poolIndex];
    const withdrawAmount = 10;

    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const startingOnusdAmount = fromCloneScale(onusdTokenAccountInfo.amount);
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const startingOnassetAmount = fromCloneScale(
      onassetTokenAccountInfo.amount
    );

    let ix = cloneClient.withdrawLiquidityFromCometInstruction(
      toCloneScale(withdrawAmount),
      positionIndex
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;
    position = comet.positions[positionIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.isAtLeast(
      fromCloneScale(onusdTokenAccountInfo.amount),
      startingOnusdAmount,
      "check onusd user balance"
    );

    assert.isAtLeast(
      fromCloneScale(onassetTokenAccountInfo.amount),
      startingOnassetAmount,
      "check onasset user balance"
    );
  });

  it("onasset bought!", async () => {
    let poolIndex = 0;
    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[poolIndex];
    let oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let startingOnusdBalance =
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    let startingOnassetBalance =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;

    const treasuryOnassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    await cloneClient.provider.sendAndConfirm!(
      new Transaction()
        .add(
          await createAssociatedTokenAccountInstruction(
            cloneClient.provider.publicKey!,
            treasuryOnassetAssociatedTokenAddress,
            treasuryAddress.publicKey,
            pool.assetInfo.onassetMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
        .add(
          await createAssociatedTokenAccountInstruction(
            cloneClient.provider.publicKey!,
            treasuryOnusdAssociatedTokenAddress,
            treasuryAddress.publicKey,
            cloneClient.clone!.onusdMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
    );

    treasuryOnassetTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnassetAssociatedTokenAddress,
      "recent"
    );
    treasuryOnusdTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnusdAssociatedTokenAddress,
      "recent"
    );
    let updatePriceIx = cloneClient.updatePricesInstruction(tokenData);
    const amountToBuy = 10000;
    let executionEst = calculateSwapExecution(
      amountToBuy,
      false,
      false,
      fromCloneScale(pool.onusdIld),
      fromCloneScale(pool.onassetIld),
      fromCloneScale(pool.committedOnusdLiquidity),
      fromScale(pool.liquidityTradingFeeBps, 4),
      fromScale(pool.treasuryTradingFeeBps, 4),
      fromScale(oracle.price, oracle.expo)
    );
    // Buy via specified onasset for output
    let buyIx = cloneClient.swapInstruction(
      poolIndex,
      toCloneScale(amountToBuy),
      false,
      false,
      toCloneScale(executionEst.result * 1.005),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePriceIx).add(buyIx)
    );

    tokenData = await cloneClient.getTokenData();

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnusdBalance - executionEst.result,
      1e-7,
      "check user onusd balance."
    );
    assert.closeTo(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnassetBalance + amountToBuy,
      1e-7,
      "check user onAsset balance."
    );

    startingOnusdBalance =
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    startingOnassetBalance =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[poolIndex];
    oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    // Second buy, via specified onUsd for input
    const onusdToConvert = 20000;
    executionEst = calculateSwapExecution(
      onusdToConvert,
      true,
      true,
      fromCloneScale(pool.onusdIld),
      fromCloneScale(pool.onassetIld),
      fromCloneScale(pool.committedOnusdLiquidity),
      fromScale(pool.liquidityTradingFeeBps, 4),
      fromScale(pool.treasuryTradingFeeBps, 4),
      fromScale(oracle.price, oracle.expo)
    );
    // Buy via specified onasset for output
    let convertIx = cloneClient.swapInstruction(
      poolIndex,
      toCloneScale(onusdToConvert),
      true,
      true,
      toCloneScale(executionEst.result * 0.995),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePriceIx).add(convertIx)
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnusdBalance - onusdToConvert,
      1e-7,
      "check user onusd balance."
    );
    assert.closeTo(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnassetBalance + executionEst.result,
      1e-7,
      "check user onAsset balance."
    );
  });

  it("onasset sold!", async () => {
    let tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    let pool = tokenData.pools[poolIndex];
    let oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let startingOnusdBalance =
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    let startingOnassetBalance =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    let updatePriceIx = cloneClient.updatePricesInstruction(tokenData);
    let amountToSell = 10000;
    // Test with user CLN stake tier 0.
    let executionEst = calculateSwapExecution(
      amountToSell,
      true,
      false,
      fromCloneScale(pool.onusdIld),
      fromCloneScale(pool.onassetIld),
      fromCloneScale(pool.committedOnusdLiquidity),
      tier0.lpTradingFeeBps * 1e-4,
      tier0.treasuryTradingFeeBps * 1e-4,
      fromScale(oracle.price, oracle.expo)
    );
    // Sell specifying input (onAsset)
    let sellIx = cloneClient.swapInstruction(
      poolIndex,
      toCloneScale(amountToSell),
      true,
      false,
      toCloneScale(executionEst.result * 0.995),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address,
      {
        cloneStaking: cloneStakingAddress,
        cloneStakingProgram: cloneStakingProgramId,
        userStakingAccount: userStakingAddress,
      }
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePriceIx).add(sellIx)
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnusdBalance + executionEst.result,
      1e-6,
      "check user onusd balance"
    );
    assert.closeTo(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnassetBalance - amountToSell,
      1e-6,
      "check user onAsset balance"
    );

    startingOnusdBalance =
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    startingOnassetBalance =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;
    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[poolIndex];
    oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    // Second sell, via specified onUsd for output
    const onusdToRecieve = 20000;
    executionEst = calculateSwapExecution(
      onusdToRecieve,
      false,
      true,
      fromCloneScale(pool.onusdIld),
      fromCloneScale(pool.onassetIld),
      fromCloneScale(pool.committedOnusdLiquidity),
      fromScale(pool.liquidityTradingFeeBps, 4),
      fromScale(pool.treasuryTradingFeeBps, 4),
      fromScale(oracle.price, oracle.expo)
    );
    // Buy via specified onasset for output
    let convertIx = cloneClient.swapInstruction(
      poolIndex,
      toCloneScale(onusdToRecieve),
      false,
      true,
      toCloneScale(executionEst.result * 1.005),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePriceIx).add(convertIx)
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnusdBalance + onusdToRecieve,
      1e-7,
      "check user onusd balance."
    );
    assert.closeTo(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnassetBalance - executionEst.result,
      1e-7,
      "check user onAsset balance."
    );
  });

  it("pay ILD + claim rewards", async () => {
    let userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;
    let tokenData = await cloneClient.getTokenData();
    let cometPositionIndex = 0;
    let ildInfo = getILD(tokenData, comet)[cometPositionIndex];
    let pool =
      tokenData.pools[Number(comet.positions[cometPositionIndex].poolIndex)];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let startingOnusdAmount =
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    let startingOnassetAmount =
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION;

    // Pay ILD
    let payILDIx0 = cloneClient.payCometILDInstruction(
      tokenData,
      userAccount,
      cometPositionIndex,
      toCloneScale(ildInfo.onAssetILD),
      false,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address
    );

    let payILDIx1 = cloneClient.payCometILDInstruction(
      tokenData,
      userAccount,
      cometPositionIndex,
      toCloneScale(ildInfo.onusdILD),
      true,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address
    );

    // Collect rewards and pay down ILD
    let collectRewardIx = cloneClient.collectLpRewardsInstruction(
      tokenData,
      userAccount,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      cometPositionIndex
    );

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    await provider.sendAndConfirm!(
      new Transaction().add(
        updatePricesIx,
        payILDIx0,
        payILDIx1,
        collectRewardIx
      )
    );

    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;
    tokenData = await cloneClient.getTokenData();
    let finalIldInfo = getILD(tokenData, comet)[cometPositionIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(finalIldInfo.onAssetILD, 0, "onAsset ILD nonzero");
    assert.equal(finalIldInfo.onusdILD, 0, "onUsd ILD nonzero");

    assert.closeTo(
      Number(onusdTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnusdAmount - ildInfo.onusdILD,
      1e-7,
      "check onusd account balance"
    );

    assert.closeTo(
      Number(onassetTokenAccountInfo.amount) * CLONE_SCALE_CONVERSION,
      startingOnassetAmount - ildInfo.onAssetILD,
      1e-7,
      "check onasset account balance"
    );
  });

  it("Create second pool", async () => {
    let mockAssetMint2 = anchor.web3.Keypair.generate();
    let price = 1;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    let priceFeed2 = await createPriceFeed(
      provider,
      pythProgramId,
      price,
      expo,
      conf
    );
    let currentPrice = (await getFeedData(provider, priceFeed2)).aggregate
      .price;
    assert.equal(currentPrice, price, "check initial price");

    await provider.sendAndConfirm(
      new Transaction().add(
        createCreateAssetInstruction(
          {
            payer: provider.publicKey!,
            assetMint: mockAssetMint2.publicKey,
            jupiterAccount: jupiterAddress,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          { pythOracle: priceFeed2 }
        )
      ),
      [mockAssetMint2]
    );

    const jupiterData = await Jupiter.fromAccountAddress(
      provider.connection,
      jupiterAddress
    );

    await cloneClient.addOracleInfo(priceFeed2);

    await cloneClient.initializePool(
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      ilHealthScoreCoefficient,
      healthScoreCoefficient,
      1,
      jupiterData.assetMints[1]
    );
  });

  it("comet liquidated!", async () => {
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let tokenData = await cloneClient.getTokenData();
    const liquidityToAdd = 1000000;

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    let addLiquidityPoolZeroIx = cloneClient.addLiquidityToCometInstruction(
      toCloneScale(liquidityToAdd),
      0
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(addLiquidityPoolZeroIx)
    );
    let addLiquidityPoolOneIx = cloneClient.addLiquidityToCometInstruction(
      toCloneScale(liquidityToAdd),
      1
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(addLiquidityPoolOneIx)
    );

    let poolIndex = 0;
    let pool = tokenData.pools[poolIndex];
    let oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    const treasuryOnassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    treasuryOnassetTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnassetAssociatedTokenAddress,
      "recent"
    );
    treasuryOnusdTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnusdAssociatedTokenAddress,
      "recent"
    );
    const amountToBuy = 10000;
    let executionEst = calculateSwapExecution(
      amountToBuy,
      false,
      false,
      fromCloneScale(pool.onusdIld),
      fromCloneScale(pool.onassetIld),
      fromCloneScale(pool.committedOnusdLiquidity),
      fromScale(pool.liquidityTradingFeeBps, 4),
      fromScale(pool.treasuryTradingFeeBps, 4),
      fromScale(oracle.price, oracle.expo)
    );
    // Buy via specified onasset for output
    let buyIx = cloneClient.swapInstruction(
      poolIndex,
      toCloneScale(amountToBuy),
      false,
      false,
      toCloneScale(executionEst.result * 1.005),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(buyIx)
    );

    let collateral = tokenData.collaterals[0];

    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      collateral.mint
    );
    let userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;

    let startingHealthScore = getHealthScore(tokenData, comet);

    let liquidationIx = cloneClient.liquidateCometPositionInstruction(
      tokenData,
      userAccount,
      cloneClient.provider.publicKey!,
      0,
      0,
      new BN(10000000000000),
      false,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      collateralTokenAccountInfo.address
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(liquidationIx)
    );

    tokenData = await cloneClient.getTokenData();
    userAccount = await cloneClient.getUserAccount();
    comet = userAccount.comet;
    let healthScore = getHealthScore(tokenData, comet);

    assert.isAbove(
      healthScore.healthScore,
      startingHealthScore.healthScore,
      "check health score"
    );
    assert.equal(healthScore.ildHealthImpact, 0, "check ild health impact.");
  });

  it("pool frozen", async () => {
    let tokenData = await cloneClient.getTokenData();
    let poolIndex = 1;
    let pool = tokenData.pools[poolIndex];
    let oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    // change status to frozen
    await cloneClient.updatePoolParameters({
      index: poolIndex,
      params: {
        __kind: "Status",
        value: new BN(1),
      },
    });

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    const treasuryOnassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(
        await createAssociatedTokenAccountInstruction(
          cloneClient.provider.publicKey!,
          treasuryOnassetAssociatedTokenAddress,
          treasuryAddress.publicKey,
          pool.assetInfo.onassetMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    );

    treasuryOnassetTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnassetAssociatedTokenAddress,
      "recent"
    );
    treasuryOnusdTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnusdAssociatedTokenAddress,
      "recent"
    );
    const amountToBuy = 10;
    let executionEst = calculateSwapExecution(
      amountToBuy,
      false,
      false,
      fromCloneScale(pool.onusdIld),
      fromCloneScale(pool.onassetIld),
      fromCloneScale(pool.committedOnusdLiquidity),
      fromScale(pool.liquidityTradingFeeBps, 4),
      fromScale(pool.treasuryTradingFeeBps, 4),
      fromScale(oracle.price, oracle.expo)
    );
    // Buy via specified onasset for output
    let buyIx = cloneClient.swapInstruction(
      poolIndex,
      toCloneScale(amountToBuy),
      false,
      false,
      toCloneScale(executionEst.result * 1.005),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    let errorOccured = false;
    try {
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(buyIx)
      );
    } catch (error) {
      errorOccured = true;
    }
    assert.equal(errorOccured, true);
  });

  it("comet liquidated due to Liquidation status!", async () => {
    let tokenData = await cloneClient.getTokenData();
    let userAccount = await cloneClient.getUserAccount();

    // change status to liquidation
    await cloneClient.updatePoolParameters({
      index: 1,
      params: {
        __kind: "Status",
        value: new BN(3),
      },
    });

    let collateral = tokenData.collaterals[0];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      tokenData.pools[1].assetInfo.onassetMint
    );
    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      collateral.mint
    );

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    let liquidationIx = cloneClient.liquidateCometPositionInstruction(
      tokenData,
      userAccount,
      cloneClient.provider.publicKey!,
      1,
      0,
      new BN(10000000000000),
      false,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      collateralTokenAccountInfo.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(liquidationIx)
    );

    tokenData = await cloneClient.getTokenData();
    userAccount = await cloneClient.getUserAccount();
    let comet = userAccount.comet;
    let healthScore = getHealthScore(tokenData, comet);

    assert.closeTo(healthScore.healthScore, 100, 1, "check health score.");

    // change status to active
    await cloneClient.updatePoolParameters({
      index: 1,
      params: {
        __kind: "Status",
        value: new BN(0),
      },
    });
  });

  it("borrow position liquidation", async () => {
    let tokenData = await cloneClient.getTokenData();
    let userAccount = await cloneClient.getUserAccount();
    let userborrowPositions = userAccount.borrows;
    let positionIndex = 1;
    let position = userborrowPositions.positions[positionIndex];
    let poolIndex = Number(position.poolIndex);
    let collateralIndex = Number(position.collateralIndex);
    let collateral = tokenData.collaterals[collateralIndex];
    let pool = tokenData.pools[poolIndex];
    let oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];
    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      collateral.mint
    );
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    let updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    let oraclePrice = fromScale(oracle.price, oracle.expo);

    // Mint more onasset to pay for liquidation.
    let ix = cloneClient.initializeBorrowPositionInstruction(
      tokenData,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      toCloneScale(19000),
      toCloneScale(19000 * oraclePrice * 1.51),
      poolIndex,
      collateralIndex
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    userAccount = await cloneClient.getUserAccount();
    userborrowPositions = userAccount.borrows;
    position = userborrowPositions.positions[positionIndex];
    let collateralAmount = fromScale(
      position.collateralAmount,
      collateral.scale
    );

    let priceThreshold =
      collateralAmount / (1.5 * fromCloneScale(position.borrowedOnasset));

    await setPrice(provider, priceThreshold * 1.1, oracle.pythAddress);

    let initialOvercollateralRatio =
      collateralAmount /
      (fromCloneScale(position.borrowedOnasset) * oraclePrice);

    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(
        cloneClient.updatePricesInstruction(tokenData),
        cloneClient.liquidateBorrowPositionInstruction(
          tokenData,
          userAccount,
          cloneClient.provider.publicKey!,
          positionIndex,
          toCloneScale(19000 * oraclePrice * 0.01),
          collateralTokenAccountInfo.address,
          onassetTokenAccountInfo.address
        )
      )
    );
    userAccount = await cloneClient.getUserAccount();
    userborrowPositions = userAccount.borrows;
    position = userborrowPositions.positions[positionIndex];
    collateralAmount = fromScale(position.collateralAmount, collateral.scale);

    let finalOvercollateralRatio =
      collateralAmount /
      (fromCloneScale(position.borrowedOnasset) * oraclePrice);

    assert.isAbove(
      finalOvercollateralRatio,
      initialOvercollateralRatio,
      "Liquidation did not finish!"
    );

    // Reset params
    await cloneClient.updatePoolParameters({
      index: 0,
      params: {
        __kind: "PositionHealthScoreCoefficient",
        value: toCloneScale(healthScoreCoefficient),
      },
    });
    await cloneClient.updatePoolParameters({
      index: 0,
      params: {
        __kind: "IlHealthScoreCoefficient",
        value: toCloneScale(ilHealthScoreCoefficient),
      },
    });
  });

  it("wrap assets and unwrap onassets", async () => {
    const poolIndex = 0;
    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[poolIndex];
    const jupiterData = await Jupiter.fromAccountAddress(
      provider.connection,
      jupiterAddress
    );

    let mockAssetAssociatedTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        jupiterData.assetMints[0]
      );

    let onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    // Get asset from jupiter
    await provider.sendAndConfirm(
      new Transaction().add(
        createMintAssetInstruction(
          {
            assetMint: jupiterData.assetMints[0],
            assetTokenAccount: mockAssetAssociatedTokenAccount.address,
            jupiterAccount: jupiterAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          {
            assetIndex: 0,
            amount: new BN(10 * 100000000),
          }
        )
      )
    );

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      jupiterData.assetMints[0]
    );

    let startingAssetBalance = Number(mockAssetAssociatedTokenAccount.amount);
    let startingOnassetBalance = Number(onassetAssociatedTokenAccount.amount);

    let amount = toCloneScale(5);

    // Wrap to onasset
    let tx = new Transaction().add(
      cloneClient.wrapAssetInstruction(
        tokenData,
        amount,
        poolIndex,
        jupiterData.assetMints[0],
        mockAssetAssociatedTokenAccount.address,
        onassetAssociatedTokenAccount.address
      )
    );
    await provider.sendAndConfirm(tx);

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      jupiterData.assetMints[0]
    );
    onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      startingAssetBalance - Number(mockAssetAssociatedTokenAccount.amount),
      Number(amount),
      "check asset"
    );
    assert.equal(
      Number(onassetAssociatedTokenAccount.amount) - startingOnassetBalance,
      Number(amount),
      "check onasset"
    );

    // Unwrap to asset
    tx = new Transaction().add(
      cloneClient.unwrapOnassetInstruction(
        tokenData,
        amount,
        poolIndex,
        jupiterData.assetMints[0],
        mockAssetAssociatedTokenAccount.address,
        onassetAssociatedTokenAccount.address
      )
    );
    await provider.sendAndConfirm(tx);

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      jupiterData.assetMints[0]
    );
    onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    assert.equal(
      Number(mockAssetAssociatedTokenAccount.amount),
      startingAssetBalance
    );
    assert.equal(
      Number(onassetAssociatedTokenAccount.amount),
      startingOnassetBalance
    );
  });

  it("withdraw all staked CLN", async () => {
    let userStakingAccount = await CloneStaking.User.fromAccountAddress(
      provider.connection,
      userStakingAddress
    );

    const getSlot = async () => {
      return await provider.connection.getSlot("finalized");
    };

    while (
      (await getSlot()) < userStakingAccount.minSlotWithdrawal.toNumber()
    ) {
      sleep(1000);
    }

    await provider.sendAndConfirm(
      new Transaction().add(
        CloneStaking.createWithdrawStakeInstruction(
          {
            user: provider.publicKey!,
            userAccount: userStakingAddress,
            cloneStaking: cloneStakingAddress,
            clnTokenMint: clnTokenMint.publicKey,
            clnTokenVault: clnTokenVault,
            userClnTokenAccount: userClnTokenAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          {
            amount: userStakingAccount.stakedTokens,
          }
        )
      )
    );

    userStakingAccount = await CloneStaking.User.fromAccountAddress(
      provider.connection,
      userStakingAddress
    );
    assert.equal(userStakingAccount.stakedTokens.toNumber(), 0);
  });
});
