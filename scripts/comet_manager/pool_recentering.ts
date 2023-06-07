// Implements the comet manager strategy

import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import { DEVNET_TOKEN_SCALE, toDevnetScale } from "../../sdk/src/clone";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { getMantissa, toNumber } from "../../sdk/src/decimal";
import {
  calculateExecutionThreshold,
  calculateExecutionThresholdFromParams,
  calculateInputFromOutputFromParams,
  calculateOutputFromInputFromParams,
  floorToDevnetScale,
} from "../../sdk/src/utils";
import {
  Clone as CloneProgram,
  IDL as CloneIDL,
} from "../../sdk/src/idl/clone";
import {
  CloneCometManager,
  IDL as CloneCometManagerIDL,
} from "../../sdk/src/idl/clone_comet_manager";
import {
  PythConnection,
  getPythProgramKeyForCluster,
  PriceData,
} from "@pythnetwork/client";
import {
  ManagerInfo,
  WithdrawCollateralFromCometInstructionAccounts,
  createWithdrawCollateralFromCometInstruction,
  AddCollateralToCometInstructionAccounts,
  CloneSwapInstructionAccounts,
  JupiterMockSwapInstructionAccounts,
  createAddCollateralToCometInstruction,
  createCloneSwapInstruction,
  WithdrawCollateralFromCometInstructionArgs,
  CloneSwapInstructionArgs,
  WithdrawLiquidityInstructionAccounts,
  createWithdrawLiquidityInstruction,
  WithdrawLiquidityInstructionArgs,
  createUnwrapOnassetInstruction,
  UnwrapOnassetInstructionAccounts,
  UnwrapOnassetInstructionArgs,
  createJupiterMockSwapInstruction,
  JupiterMockSwapInstructionArgs,
  createMintOnusdInstruction,
  MintOnusdInstructionAccounts,
  MintOnusdInstructionArgs,
  AddCollateralToCometInstructionArgs,
  createPayIldInstruction,
  PayIldInstructionAccounts,
  PayIldInstructionArgs,
  createBurnOnusdInstruction,
  BurnOnusdInstructionAccounts,
  BurnOnusdInstructionArgs,
  createWrapAssetInstruction,
  WrapAssetInstructionAccounts,
  WrapAssetInstructionArgs,
  AddLiquidityInstructionAccounts,
  createAddLiquidityInstruction,
  AddLiquidityInstructionArgs,
  Subscriber,
} from "../../sdk/generated/clone-comet-manager";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock/index";
import {
  Clone,
  TokenData,
  Comet,
  createUpdatePricesInstruction,
  UpdatePricesInstructionAccounts,
  UpdatePricesInstructionArgs,
  User,
} from "../../sdk/generated/clone/index";
import {
  getHealthScore,
  getEffectiveUSDCollateralValue,
} from "../../sdk/src/healthscore";
import {
  TokenAccountAddresses,
  getManagerTokenAccountAddresses,
  getTreasuryTokenAccountAddresses,
} from "./address_lookup";
import {
  buildUpdatePricesInstruction,
  getKeypairFromAWSSecretsManager,
  generateKeypairFromBuffer,
} from "./utils";

type PoolState = {
  eventId: anchor.BN;
  poolIndex: number;
  onasset: anchor.BN;
  onusd: anchor.BN;
  lpTokens: anchor.BN;
  oraclePrice: anchor.BN;
};

type PythSymbol = string;
type PoolId = number;
type PythPriceData = Map<PoolId, number>;
type PoolStateData = Map<PoolId, PoolState>;

// Need to define mapping from pythSymbol to poolIndex
const PYTH_SYMBOL_MAPPING: Map<PythSymbol, PoolId> = new Map([
  ["FX.EUR/USD", 0],
  ["Metal.XAU/USD", 1],
  ["Crypto.SOL/USD", 2],
  ["Crypto.ETH/USD", 3],
  ["Crypto.BTC/USD", 4],
  ["Crypto.BNB/USD", 5],
  ["Crypto.AVAX/USD", 6],
  ["Equity.US.TSLA/USD", 7],
  ["Equity.US.AAPL/USD", 8],
  ["Equity.US.AMZN/USD", 9],
]);

const getInstructionAccounts = (
  poolId: number,
  clone: Clone,
  cloneAccountAddress: PublicKey,
  managerInfo: ManagerInfo,
  managerAddresses: TokenAccountAddresses,
  managerInfoAddress: PublicKey,
  managerCloneUser: User,
  tokenData: TokenData,
  treasuryAddresses: TokenAccountAddresses,
  jupiter: Jupiter,
  jupiterAddress: PublicKey,
  jupiterProgramId: PublicKey
) => {
  let pool = tokenData.pools[poolId];
  // Setup instructions:
  const withdrawCollateralFromComet: WithdrawCollateralFromCometInstructionAccounts =
    {
      signer: managerInfo.owner,
      managerInfo: managerInfoAddress,
      clone: cloneAccountAddress,
      managerCloneUser: managerInfo.userAccount,
      onusdMint: clone.onusdMint,
      managerOnusdTokenAccount: managerAddresses.onusdToken,
      cloneProgram: managerInfo.cloneProgram,
      comet: managerCloneUser.comet,
      tokenData: clone.tokenData,
      cloneOnusdVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    };
  const addCollateralToComet: AddCollateralToCometInstructionAccounts = {
    managerOwner: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    managerCloneUser: managerInfo.userAccount,
    onusdMint: clone.onusdMint,
    comet: managerCloneUser.comet,
    tokenData: clone.tokenData,
    cloneOnusdVault: tokenData.collaterals[0].vault,
    tokenProgram: TOKEN_PROGRAM_ID,
    cloneProgram: managerInfo.cloneProgram,
    managerOnusdTokenAccount: managerAddresses.onusdToken,
  };
  const cloneSwap: CloneSwapInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    onusdMint: clone.onusdMint,
    managerOnusdTokenAccount: managerAddresses.onusdToken,
    treasuryOnusdTokenAccount: treasuryAddresses.onusdToken,
    treasuryOnassetTokenAccount: treasuryAddresses.onassetToken[poolId],
    cloneProgram: managerInfo.cloneProgram,
    tokenData: clone.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
    ammOnusdTokenAccount: pool.onusdTokenAccount,
    ammOnassetTokenAccount: pool.onassetTokenAccount,
    onassetMint: pool.assetInfo.onassetMint,
    managerOnassetTokenAccount: managerAddresses.onassetToken[poolId],
  };

  const jupiterSwap: JupiterMockSwapInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    assetMint: jupiter.assetMints[poolId],
    tokenProgram: TOKEN_PROGRAM_ID,
    usdcMint: jupiter.usdcMint,
    managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
    managerUsdcTokenAccount: managerAddresses.usdcToken,
    jupiterProgram: jupiterProgramId,
    jupiterAccount: jupiterAddress,
    pythOracle: pool.assetInfo.pythAddress,
  };

  const withdrawLiquidity: WithdrawLiquidityInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    managerCloneUser: managerInfo.userAccount,
    onusdMint: clone.onusdMint,
    cloneProgram: managerInfo.cloneProgram,
    comet: managerCloneUser.comet,
    tokenData: clone.tokenData,
    cloneOnusdVault: tokenData.collaterals[0].vault,
    onassetMint: pool.assetInfo.onassetMint,
    ammOnusdTokenAccount: pool.onusdTokenAccount,
    ammOnassetTokenAccount: pool.onassetTokenAccount,
    liquidityTokenMint: pool.liquidityTokenMint,
    cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
    managerOnassetTokenAccount: managerAddresses.onassetToken[poolId],
    managerOnusdTokenAccount: managerAddresses.onusdToken,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  const unwrapOnasset: UnwrapOnassetInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    onassetMint: tokenData.pools[poolId].assetInfo.onassetMint,
    managerOnassetTokenAccount: managerAddresses.onassetToken[poolId],
    underlyingAssetTokenAccount:
      tokenData.pools[poolId].underlyingAssetTokenAccount,
    assetMint: jupiter.assetMints[poolId],
    managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
    cloneProgram: managerInfo.cloneProgram,
    tokenData: clone.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  const updatePrices: UpdatePricesInstructionAccounts = {
    clone: cloneAccountAddress,
    tokenData: clone.tokenData,
  };

  const burnOnusd: BurnOnusdInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    onusdMint: clone.onusdMint,
    managerOnusdTokenAccount: managerAddresses.onusdToken,
    usdcMint: jupiter.usdcMint,
    managerUsdcTokenAccount: managerAddresses.usdcToken,
    cloneProgram: managerInfo.cloneProgram,
    tokenData: clone.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
    cloneUsdcVault: tokenData.collaterals[1].vault,
  };

  const mintOnusd: MintOnusdInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    onusdMint: clone.onusdMint,
    managerOnusdTokenAccount: managerAddresses.onusdToken,
    usdcMint: jupiter.usdcMint,
    managerUsdcTokenAccount: managerAddresses.usdcToken,
    cloneProgram: managerInfo.cloneProgram,
    tokenData: clone.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
    cloneUsdcVault: tokenData.collaterals[1].vault,
  };

  const wrapAsset: WrapAssetInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    onassetMint: tokenData.pools[poolId].assetInfo.onassetMint,
    managerOnassetTokenAccount: managerAddresses.onassetToken[poolId],
    underlyingAssetTokenAccount:
      tokenData.pools[poolId].underlyingAssetTokenAccount,
    assetMint: jupiter.assetMints[poolId],
    managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
    cloneProgram: managerInfo.cloneProgram,
    tokenData: clone.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  const payIld: PayIldInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    managerCloneUser: managerInfo.userAccount,
    onusdMint: clone.onusdMint,
    cloneProgram: managerInfo.cloneProgram,
    comet: managerCloneUser.comet,
    tokenData: clone.tokenData,
    onassetMint: tokenData.pools[poolId].assetInfo.onassetMint,
    ammOnusdTokenAccount: pool.onusdTokenAccount,
    ammOnassetTokenAccount: pool.onassetTokenAccount,
    managerOnassetTokenAccount: managerAddresses.onassetToken[poolId],
    managerOnusdTokenAccount: managerAddresses.onusdToken,
    tokenProgram: TOKEN_PROGRAM_ID,
    cloneOnusdVault: tokenData.collaterals[0].vault,
  };

  const addLiquidityToComet: AddLiquidityInstructionAccounts = {
    managerOwner: managerInfo.owner,
    managerInfo: managerInfoAddress,
    clone: cloneAccountAddress,
    managerCloneUser: managerInfo.userAccount,
    onusdMint: clone.onusdMint,
    cloneProgram: managerInfo.cloneProgram,
    comet: managerCloneUser.comet,
    tokenData: clone.tokenData,
    onassetMint: pool.assetInfo.onassetMint,
    ammOnusdTokenAccount: pool.onusdTokenAccount,
    ammOnassetTokenAccount: pool.onassetTokenAccount,
    liquidityTokenMint: pool.liquidityTokenMint,
    cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  return {
    withdrawCollateralFromComet,
    addCollateralToComet,
    cloneSwap,
    jupiterSwap,
    withdrawLiquidity,
    unwrapOnasset,
    updatePrices,
    burnOnusd,
    mintOnusd,
    wrapAsset,
    payIld,
    addLiquidityToComet,
  };
};

const calculateOnassetTrade = (
  poolOnusd: number,
  poolOnasset: number,
  treasuryFee: number,
  liquidityFee: number,
  targetPrice: number
) => {
  const currentPrice = poolOnusd / poolOnasset;
  const isBuy = currentPrice < targetPrice;

  let [fn, start, end] = (() => {
    if (isBuy) {
      return [
        (x: number) => {
          let res = calculateInputFromOutputFromParams(
            poolOnusd,
            poolOnasset,
            treasuryFee,
            liquidityFee,
            x,
            false
          );
          return res.resultPoolOnusd / res.resultPoolOnasset;
        },
        0,
        poolOnasset,
      ];
    } else {
      return [
        (x: number) => {
          let res = calculateOutputFromInputFromParams(
            poolOnusd,
            poolOnasset,
            treasuryFee,
            liquidityFee,
            x,
            false
          );
          return res.resultPoolOnusd / res.resultPoolOnasset;
        },
        poolOnusd,
        0,
      ];
    }
  })();

  const tol = 1e-6;
  const MAX_ITER = 1000;

  for (let i = 0; i < MAX_ITER; i++) {
    let x = 0.5 * (end + start);
    let val = fn(x);
    let diff = val - targetPrice;

    if (Math.abs(diff) / targetPrice < tol) {
      return x * (isBuy ? 1 : -1);
    }

    if (val < targetPrice) {
      start = x;
    } else {
      end = x;
    }
  }
  throw new Error("Could not converge on solution!");
};

const onPriceChangeUpdate = async (
  provider: anchor.Provider,
  poolId: number,
  oraclePrice: number,
  poolData: PoolState,
  managerInfo: ManagerInfo,
  managerInfoAddress: PublicKey,
  managerAddresses: TokenAccountAddresses,
  treasuryAddresses: TokenAccountAddresses,
  managerCloneUser: User,
  clone: Clone,
  cloneAccountAddress: PublicKey,
  tokenData: TokenData,
  comet: Comet,
  jupiter: Jupiter,
  jupiterProgramId: PublicKey,
  jupiterAddress: PublicKey,
  jupiterNonce: number,
  pricePctThreshold: number,
  addressLookupTableAccount: anchor.web3.AddressLookupTableAccount
): Promise<boolean> => {
  console.log("POOL DATA:", poolId, poolData);
  const conversionFactor = Math.pow(10, -DEVNET_TOKEN_SCALE);
  const poolOnusd = poolData.onusd.toNumber() * conversionFactor;
  const poolOnasset = poolData.onasset.toNumber() * conversionFactor;
  const poolPrice = poolOnusd / poolOnasset;
  console.log(
    "TOKEN DATA POOL PRICE:",
    toNumber(tokenData.pools[0].onusdAmount),
    toNumber(tokenData.pools[0].onassetAmount)
  );
  console.log(
    "PRICES: pool, oracle, saved oracle:",
    poolPrice,
    oraclePrice,
    toNumber(tokenData.pools[poolId].assetInfo.price)
  );
  const lowerThreshold = poolPrice * (1 - pricePctThreshold);
  const higherThrehsold = poolPrice * (1 + pricePctThreshold);
  const lowerBreached = oraclePrice < lowerThreshold;
  const higherBreached = oraclePrice > higherThrehsold;
  console.log("Thresholds breached:", lowerBreached, higherBreached);
  if (!lowerBreached && !higherBreached) return false;

  const [cometPositionIndex, cometPosition] = (() => {
    for (let i = 0; i < Number(comet.numPositions); i++) {
      if (Number(comet.positions[i].poolIndex) === poolId)
        return [i, comet.positions[i]];
    }
    return [undefined, undefined];
  })();

  if (cometPosition === undefined) {
    return false;
  }

  const pool = tokenData.pools[poolId];
  const treasuryFee = toNumber(pool.treasuryTradingFee);
  const liquidityFee = toNumber(pool.liquidityTradingFee);

  const lpTokens = toNumber(cometPosition.liquidityTokenValue);
  const lpTokenSupply = poolData.lpTokens.toNumber() * conversionFactor;
  const L = lpTokens / lpTokenSupply;
  const claimableOnusd = L * poolOnusd;
  const claimableOnasset = L * poolOnasset;
  // Estimate pool after withdrawing all liquidity
  const newPoolOnusd = poolOnusd - claimableOnusd;
  const newPoolOnasset = poolOnasset - claimableOnasset;
  console.log("pools:", poolOnusd, poolOnasset, claimableOnusd, claimableOnasset);
  console.log("NEW POOL AMOUNTS:", newPoolOnusd, newPoolOnasset);
  // Figure out how much reward is gained, where to sell if in onasset.
  // Figure out how much ILD is owed.
  const onassetILD = toNumber(cometPosition.borrowedOnasset) - claimableOnasset;
  const onusdILD = toNumber(cometPosition.borrowedOnusd) - claimableOnusd;
  console.log("ILD/REWARD:", onusdILD, onassetILD);
  // Figure out how much buy/sell is needed to push price to oracle. NOTE that this will be arbed.
  // Use simple invariant equation for now. Positive means buy.
  const onassetCloneTrade = (() => {
    if (newPoolOnusd > 0 && newPoolOnasset > 0) {
      return calculateOnassetTrade(
        newPoolOnusd,
        newPoolOnasset,
        treasuryFee,
        liquidityFee,
        oraclePrice
      );
    }
    return 0;
  })();
  // For other side of arb trade, always perform the opposite action but net the onasset ILD/reward.
  const jupiterExchangeTrade = -onassetCloneTrade + onassetILD;
  console.log("TRADES:", onassetCloneTrade, jupiterExchangeTrade);

  const ixnAccounts = getInstructionAccounts(
    poolId,
    clone,
    cloneAccountAddress,
    managerInfo,
    managerAddresses,
    managerInfoAddress,
    managerCloneUser,
    tokenData,
    treasuryAddresses,
    jupiter,
    jupiterAddress,
    jupiterProgramId
  );

  console.log("LP TOKENS TO WITHDRAW:", lpTokens, lpTokenSupply);
  let instructions: TransactionInstruction[] = [
    // Update prices instruction.
    buildUpdatePricesInstruction(
      cloneAccountAddress,
      clone.tokenData,
      tokenData
    ),
    // Withdraw all liquidity
    createWithdrawLiquidityInstruction(ixnAccounts.withdrawLiquidity, {
      cometPositionIndex,
      liquidityTokenAmount: toDevnetScale(lpTokens),
    } as WithdrawLiquidityInstructionArgs),
  ];
  // SCENARIO 1: Pool price < Jupiter price
  //
  if (higherBreached) {
    // If buying on clone:
    if (onassetCloneTrade > 0) {
      // Estimate required USDi
      const execution = calculateExecutionThresholdFromParams(
        onassetCloneTrade,
        true,
        newPoolOnusd,
        newPoolOnasset,
        treasuryFee,
        liquidityFee,
        0.0005
      );
      const onusdToWithdraw = execution.expectedOnusdAmount - claimableOnusd;
      // Withdraw USDi from collateral
      if (onusdToWithdraw > 0) {
        instructions.push(
          createWithdrawCollateralFromCometInstruction(
            ixnAccounts.withdrawCollateralFromComet,
            {
              amount: toDevnetScale(onusdToWithdraw),
            } as WithdrawCollateralFromCometInstructionArgs
          )
        );
      }
      // Buy Onasset on clone
      instructions.push(
        createCloneSwapInstruction(ixnAccounts.cloneSwap, {
          isBuy: true,
          poolIndex: poolId,
          amount: toDevnetScale(onassetCloneTrade),
          onusdThreshold: toDevnetScale(execution.onusdThresholdAmount),
        } as CloneSwapInstructionArgs)
      );
    }

    if (jupiterExchangeTrade !== 0) {
      // convert to asset
      instructions.push(
        createUnwrapOnassetInstruction(ixnAccounts.unwrapOnasset, {
          amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
          poolIndex: poolId,
        } as UnwrapOnassetInstructionArgs)
      );
      // sell underlying asset on jupiter
      instructions.push(
        createJupiterMockSwapInstruction(ixnAccounts.jupiterSwap, {
          jupiterNonce,
          isBuy: false,
          assetIndex: poolId,
          amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
        } as JupiterMockSwapInstructionArgs)
      );
      // Convert USDC -> USDi
      const saleUsdAmount =
        Math.abs(jupiterExchangeTrade) * toNumber(pool.assetInfo.price);
      instructions.push(
        createMintOnusdInstruction(ixnAccounts.mintOnusd, {
          amount: toDevnetScale(saleUsdAmount),
        } as MintOnusdInstructionArgs)
      );
      // Deposit USDi to collateral, subtract any USDi required for payILD
      const collateralDeposit = saleUsdAmount - Math.max(0, onusdILD);
      instructions.push(
        createAddCollateralToCometInstruction(
          ixnAccounts.addCollateralToComet,
          {
            amount: toDevnetScale(collateralDeposit),
          } as AddCollateralToCometInstructionArgs
        )
      );
    }
  } else {
    // SCENARIO 2
    // Estimate required USDC for trade, net the reward from USDi
    const requiredUsdc = jupiterExchangeTrade * toNumber(pool.assetInfo.price);
    const onusdToWithdraw = requiredUsdc - claimableOnusd;
    console.log(requiredUsdc, jupiterExchangeTrade, onusdToWithdraw);
    if (onusdToWithdraw > 0) {
      // Withdraw USDi from collateral
      instructions.push(
        createWithdrawCollateralFromCometInstruction(
          ixnAccounts.withdrawCollateralFromComet,
          {
            amount: toDevnetScale(onusdToWithdraw),
          } as WithdrawCollateralFromCometInstructionArgs
        )
      );
    }
    if (requiredUsdc !== 0) {
      // Convert USDi -> USDC
      instructions.push(
        createBurnOnusdInstruction(ixnAccounts.burnOnusd, {
          amount: toDevnetScale(requiredUsdc),
        } as BurnOnusdInstructionArgs)
      );
    }

    if (jupiterExchangeTrade !== 0) {
      // buy underlying asset on jupiter
      instructions.push(
        createJupiterMockSwapInstruction(ixnAccounts.jupiterSwap, {
          jupiterNonce,
          isBuy: true,
          assetIndex: poolId,
          amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
        } as JupiterMockSwapInstructionArgs)
      );
      // Convert from underlying to onasset.
      instructions.push(
        createWrapAssetInstruction(ixnAccounts.wrapAsset, {
          amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
          poolIndex: poolId,
        } as WrapAssetInstructionArgs)
      );
    }
    // Convert the onasset thats not used for Paying ILD to onusd and deposit it.
    if (Math.abs(onassetCloneTrade) > 0) {
      // sell on clone
      const execution = calculateExecutionThresholdFromParams(
        Math.abs(onassetCloneTrade),
        false,
        newPoolOnusd,
        newPoolOnasset,
        treasuryFee,
        liquidityFee,
        0.005
      );
      instructions.push(
        createCloneSwapInstruction(ixnAccounts.cloneSwap, {
          isBuy: false,
          poolIndex: poolId,
          amount: toDevnetScale(Math.abs(onassetCloneTrade)),
          onusdThreshold: toDevnetScale(execution.onusdThresholdAmount),
        } as CloneSwapInstructionArgs)
      );
      // Deposit USDi to collateral
      instructions.push(
        createAddCollateralToCometInstruction(
          ixnAccounts.addCollateralToComet,
          {
            amount: toDevnetScale(execution.expectedOnusdAmount),
          } as AddCollateralToCometInstructionArgs
        )
      );
    }
  }
  let collateralAmount = onusdILD > 0 ? onusdILD : onassetILD;
  if (collateralAmount > 0) {
    // Pay ILD
    instructions.push(
      createPayIldInstruction(ixnAccounts.payIld, {
        cometPositionIndex,
        payOnusdDebt: onusdILD > 0,
        collateralAmount: toDevnetScale(collateralAmount),
      } as PayIldInstructionArgs)
    );
  }

  // Add liquidity
  const onusdToAdd = L < 1 ? (L * newPoolOnusd) / (1 - L) : poolOnusd;
  console.log("LIQUIDITY TO ADD:", onusdToAdd);
  instructions.push(
    createAddLiquidityInstruction(ixnAccounts.addLiquidityToComet, {
      poolIndex: poolId,
      onusdAmount: toDevnetScale(onusdToAdd),
    } as AddLiquidityInstructionArgs)
  );
  // Create versioned transaction and send
  const { blockhash } = await provider.connection.getLatestBlockhash(
    "finalized"
  );
  console.log("NUM IXS:", instructions.length);
  const messageV0 = new anchor.web3.TransactionMessage({
    payerKey: managerInfo.owner,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([addressLookupTableAccount]);
  // create a v0 transaction from the v0 message
  const transactionV0 = new anchor.web3.VersionedTransaction(messageV0);

  await provider.sendAndConfirm!(transactionV0);

  return true;
};

const main = async () => {
  console.log("---COMET MANAGER POOL RECENTERING ALGORITHM RUNNING---");
  let config = {
    cloneProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    cloneCometManager: new PublicKey(process.env.COMET_MANAGER_PROGRAM_ID!),
    jupiterProgramId: new PublicKey(process.env.JUPITER_PROGRAM_ID!),
    lookupTableAddress: new PublicKey(process.env.LOOKUP_TABLE_ADDRESS!),
    pctThreshold: Number(process.env.PCT_THRESHOLD!), // 0.01,
    awsSecretName: process.env.AWS_SECRET_NAME,
  };
  const provider = await (async () => {
    if (config.awsSecretName) {
      const secretBuffer = await getKeypairFromAWSSecretsManager(
        config.awsSecretName!
      );
      const keypair = generateKeypairFromBuffer(JSON.parse(secretBuffer));
      const wallet = new anchor.Wallet(keypair);
      const options = anchor.AnchorProvider.defaultOptions();
      const connection = new Connection(
        process.env.ANCHOR_PROVIDER_URL!,
        options.commitment
      );
      return new anchor.AnchorProvider(connection, wallet, options);
    } else {
      return anchor.AnchorProvider.env();
    }
  })();

  const [cloneAccountAddress, _cloneNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone")],
    config.cloneProgramID
  );

  const [cometManagerAccountAddress, _cometManagerNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("manager-info"), provider.publicKey!.toBuffer()],
      config.cloneCometManager
    );

  const [jupiterAccountAddress, jupiterNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("jupiter")],
      config.jupiterProgramId
    );

  const [userAccountAddress, _cloneUserNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), cometManagerAccountAddress.toBuffer()],
      config.cloneProgramID
    );

  const clone = await Clone.fromAccountAddress(
    provider.connection,
    cloneAccountAddress
  );

  const userAccount = await User.fromAccountAddress(
    provider.connection,
    userAccountAddress
  );

  const cloneProgram = new anchor.Program<CloneProgram>(
    CloneIDL,
    config.cloneProgramID,
    provider
  );

  const managerProgram = new anchor.Program<CloneCometManager>(
    CloneCometManagerIDL,
    config.cloneCometManager,
    provider
  );

  // Current manager state
  let managerState = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerAccountAddress
  );

  let tokenData = await TokenData.fromAccountAddress(
    provider.connection,
    clone.tokenData
  );
  let comet = await Comet.fromAccountAddress(
    provider.connection,
    userAccount.comet
  );
  console.log("USDI mint:", clone.onusdMint.toString());
  console.log(
    "COMET:",
    Number(comet.numPositions),
    Number(comet.numCollaterals),
    toNumber(comet.collaterals[0].collateralAmount),
    toNumber(comet.positions[0].borrowedOnusd)
  );

  // Market state objects
  let pythPrices: PythPriceData = new Map();
  let poolStates: PoolStateData = (() => {
    let initMap = new Map();
    tokenData.pools
      .slice(0, Number(tokenData.numPools))
      .forEach((pool, index) => {
        initMap.set(index, {
          eventId: new anchor.BN(NaN),
          poolIndex: index,
          onasset: new anchor.BN(getMantissa(pool.onassetAmount)),
          onusd: new anchor.BN(getMantissa(pool.onusdAmount)),
          lpTokens: new anchor.BN(getMantissa(pool.liquidityTokenSupply)),
          oraclePrice: new anchor.BN(getMantissa(pool.assetInfo.price)),
        } as PoolState);
      });
    return initMap;
  })();

  let jupiter = await Jupiter.fromAccountAddress(
    provider.connection,
    jupiterAccountAddress
  );

  const managerAddresses = await getManagerTokenAccountAddresses(
    provider,
    cometManagerAccountAddress,
    tokenData,
    clone.onusdMint,
    jupiter.usdcMint,
    jupiter.assetMints.slice(0, jupiter.nAssets)
  );

  const treasuryAddresses = await getTreasuryTokenAccountAddresses(
    provider,
    clone.treasuryAddress,
    tokenData,
    clone.onusdMint,
    jupiter.usdcMint
  );

  const altAccount = (await provider.connection
    .getAddressLookupTable(config.lookupTableAddress)
    .then((res) => res.value))!;

  // Setup account listening
  // Subscribe to account changes
  managerProgram.account.managerInfo
    .subscribe(new PublicKey(cometManagerAccountAddress), "recent")
    .on("change", (account: ManagerInfo) => {
      managerState = account;
    });
  cloneProgram.account.tokenData
    .subscribe(clone.tokenData, "recent")
    .on("change", (account: TokenData) => {
      console.log("TOKEN DATA UPDATED!");
      tokenData = account;
    });
  cloneProgram.account.comet
    .subscribe(userAccount.comet, "recent")
    .on("change", (account: Comet) => {
      comet = account;
    });

  console.log("SUBSCRIBING!");
  let executing = false;
  // Setup pool listening
  cloneProgram.addEventListener(
    "PoolState",
    (event: PoolState, slot: number) => {
      console.log(
        `EVENT: ${event.eventId.toNumber()} POOL: ${
          event.poolIndex
        } SLOT: ${slot}`
      );
      poolStates.set(event.poolIndex, event as PoolState);
      if (!executing) {
        executing = true;
        onPriceChangeUpdate(
          provider,
          event.poolIndex,
          pythPrices.get(event.poolIndex)!,
          poolStates.get(event.poolIndex)!,
          managerState,
          cometManagerAccountAddress,
          managerAddresses,
          treasuryAddresses,
          userAccount,
          clone,
          cloneAccountAddress,
          tokenData,
          comet,
          jupiter,
          config.jupiterProgramId,
          jupiterAccountAddress,
          jupiterNonce,
          config.pctThreshold,
          altAccount
        )
          .then((result) => {
            console.log("Algorithm ran:", event.poolIndex, result);
          })
          .catch((error) => {
            console.log("Something went wrong:", error);
          })
          .finally(() => {
            executing = false;
          });
      }
    }
  );

  // Setup Pyth listening, NOTE: this is relevant for devnet only.
  // TODO: Refactor to extract the price only.
  // Once we switch away from using Jupiter Mock Agg into the real jupiter we'll have to
  // figure out either streaming or polling quotes from Jupiter for our specific routes.
  const pythConnection = new PythConnection(
    provider.connection,
    getPythProgramKeyForCluster("devnet")
  );
  pythConnection.onPriceChange((product, data) => {
    let poolIndex = PYTH_SYMBOL_MAPPING.get(product.symbol);
    if (poolIndex === undefined) return;
    pythPrices.set(poolIndex, data.price!);
    if (!executing) {
      executing = true;
      onPriceChangeUpdate(
        provider,
        poolIndex,
        pythPrices.get(poolIndex)!,
        poolStates.get(poolIndex)!,
        managerState,
        cometManagerAccountAddress,
        managerAddresses,
        treasuryAddresses,
        userAccount,
        clone,
        cloneAccountAddress,
        tokenData,
        comet,
        jupiter,
        config.jupiterProgramId,
        jupiterAccountAddress,
        jupiterNonce,
        config.pctThreshold,
        altAccount
      )
        .then((result) => {
          console.log("Algorithm ran:", result);
        })
        .catch((error) => {
          console.log("Something went wrong:", error);
        })
        .finally(() => {
          executing = false;
        });
    }
  });
  // Start listening for price change events.
  await pythConnection.start();
};

main();
