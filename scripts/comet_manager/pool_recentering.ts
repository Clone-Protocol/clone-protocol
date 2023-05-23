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
import { DEVNET_TOKEN_SCALE, toDevnetScale } from "../../sdk/src/incept";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { toNumber } from "../../sdk/src/decimal";
import {
  calculateExecutionThreshold,
  calculateExecutionThresholdFromParams,
  calculateInputFromOutputFromParams,
  calculateOutputFromInputFromParams,
  floorToDevnetScale,
} from "../../sdk/src/utils";
import {
  Incept as InceptProgram,
  IDL as InceptIDL,
} from "../../sdk/src/idl/incept";
import {
  InceptCometManager,
  IDL as InceptCometManagerIDL,
} from "../../sdk/src/idl/incept_comet_manager";
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
  InceptSwapInstructionAccounts,
  JupiterMockSwapInstructionAccounts,
  createAddCollateralToCometInstruction,
  createInceptSwapInstruction,
  WithdrawCollateralFromCometInstructionArgs,
  InceptSwapInstructionArgs,
  WithdrawLiquidityInstructionAccounts,
  createWithdrawLiquidityInstruction,
  WithdrawLiquidityInstructionArgs,
  createUnwrapIassetInstruction,
  UnwrapIassetInstructionAccounts,
  UnwrapIassetInstructionArgs,
  createJupiterMockSwapInstruction,
  JupiterMockSwapInstructionArgs,
  createMintUsdiInstruction,
  MintUsdiInstructionAccounts,
  MintUsdiInstructionArgs,
  AddCollateralToCometInstructionArgs,
  createPayIldInstruction,
  PayIldInstructionAccounts,
  PayIldInstructionArgs,
  createBurnUsdiInstruction,
  BurnUsdiInstructionAccounts,
  BurnUsdiInstructionArgs,
  createWrapAssetInstruction,
  WrapAssetInstructionAccounts,
  WrapAssetInstructionArgs,
  AddLiquidityInstructionAccounts,
  createAddLiquidityInstruction,
  AddLiquidityInstructionArgs,
  Subscriber,
} from "../../sdk/generated/incept-comet-manager";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock/index";
import {
  Incept,
  TokenData,
  Comet,
  createUpdatePricesInstruction,
  UpdatePricesInstructionAccounts,
  UpdatePricesInstructionArgs,
  User,
} from "../../sdk/generated/incept/index";
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
  updatePricesInstructionCreate
} from "./utils"

type PoolState = {
  eventId: anchor.BN;
  poolIndex: number;
  iasset: anchor.BN;
  usdi: anchor.BN;
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
  incept: Incept,
  inceptAccountAddress: PublicKey,
  managerInfo: ManagerInfo,
  managerAddresses: TokenAccountAddresses,
  managerInfoAddress: PublicKey,
  managerInceptUser: User,
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
      incept: inceptAccountAddress,
      managerInceptUser: managerInfo.userAccount,
      usdiMint: incept.usdiMint,
      managerUsdiTokenAccount: managerAddresses.usdiToken,
      inceptProgram: managerInfo.inceptProgram,
      comet: managerInceptUser.comet,
      tokenData: incept.tokenData,
      inceptUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    };
  const addCollateralToComet: AddCollateralToCometInstructionAccounts = {
    managerOwner: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    managerInceptUser: managerInfo.userAccount,
    usdiMint: incept.usdiMint,
    comet: managerInceptUser.comet,
    tokenData: incept.tokenData,
    inceptUsdiVault: tokenData.collaterals[0].vault,
    tokenProgram: TOKEN_PROGRAM_ID,
    inceptProgram: managerInfo.inceptProgram,
    managerUsdiTokenAccount: managerAddresses.usdiToken,
  };
  const inceptSwap: InceptSwapInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    usdiMint: incept.usdiMint,
    managerUsdiTokenAccount: managerAddresses.usdiToken,
    treasuryUsdiTokenAccount: treasuryAddresses.usdiToken,
    treasuryIassetTokenAccount: treasuryAddresses.iassetToken[poolId],
    inceptProgram: managerInfo.inceptProgram,
    tokenData: incept.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
    ammUsdiTokenAccount: pool.usdiTokenAccount,
    ammIassetTokenAccount: pool.iassetTokenAccount,
    iassetMint: pool.assetInfo.iassetMint,
    managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
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
    incept: inceptAccountAddress,
    managerInceptUser: managerInfo.userAccount,
    usdiMint: incept.usdiMint,
    inceptProgram: managerInfo.inceptProgram,
    comet: managerInceptUser.comet,
    tokenData: incept.tokenData,
    inceptUsdiVault: tokenData.collaterals[0].vault,
    iassetMint: pool.assetInfo.iassetMint,
    ammUsdiTokenAccount: pool.usdiTokenAccount,
    ammIassetTokenAccount: pool.iassetTokenAccount,
    liquidityTokenMint: pool.liquidityTokenMint,
    cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
    managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
    managerUsdiTokenAccount: managerAddresses.usdiToken,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  const unwrapIasset: UnwrapIassetInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    iassetMint: tokenData.pools[poolId].assetInfo.iassetMint,
    managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
    underlyingAssetTokenAccount:
      tokenData.pools[poolId].underlyingAssetTokenAccount,
    assetMint: jupiter.assetMints[poolId],
    managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
    inceptProgram: managerInfo.inceptProgram,
    tokenData: incept.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  const updatePrices: UpdatePricesInstructionAccounts = {
    incept: inceptAccountAddress,
    tokenData: incept.tokenData,
  };

  const burnUsdi: BurnUsdiInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    usdiMint: incept.usdiMint,
    managerUsdiTokenAccount: managerAddresses.usdiToken,
    usdcMint: jupiter.usdcMint,
    managerUsdcTokenAccount: managerAddresses.usdcToken,
    inceptProgram: managerInfo.inceptProgram,
    tokenData: incept.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
    inceptUsdcVault: tokenData.collaterals[1].vault,
  };

  const mintUsdi: MintUsdiInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    usdiMint: incept.usdiMint,
    managerUsdiTokenAccount: managerAddresses.usdiToken,
    usdcMint: jupiter.usdcMint,
    managerUsdcTokenAccount: managerAddresses.usdcToken,
    inceptProgram: managerInfo.inceptProgram,
    tokenData: incept.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
    inceptUsdcVault: tokenData.collaterals[1].vault,
  };

  const wrapAsset: WrapAssetInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    iassetMint: tokenData.pools[poolId].assetInfo.iassetMint,
    managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
    underlyingAssetTokenAccount:
      tokenData.pools[poolId].underlyingAssetTokenAccount,
    assetMint: jupiter.assetMints[poolId],
    managerAssetTokenAccount: managerAddresses.underlyingToken![poolId],
    inceptProgram: managerInfo.inceptProgram,
    tokenData: incept.tokenData,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  const payIld: PayIldInstructionAccounts = {
    signer: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    managerInceptUser: managerInfo.userAccount,
    usdiMint: incept.usdiMint,
    inceptProgram: managerInfo.inceptProgram,
    comet: managerInceptUser.comet,
    tokenData: incept.tokenData,
    iassetMint: tokenData.pools[poolId].assetInfo.iassetMint,
    ammUsdiTokenAccount: pool.usdiTokenAccount,
    ammIassetTokenAccount: pool.iassetTokenAccount,
    managerIassetTokenAccount: managerAddresses.iassetToken[poolId],
    managerUsdiTokenAccount: managerAddresses.usdiToken,
    tokenProgram: TOKEN_PROGRAM_ID,
    inceptUsdiVault: tokenData.collaterals[0].vault,
  };

  const addLiquidityToComet: AddLiquidityInstructionAccounts = {
    managerOwner: managerInfo.owner,
    managerInfo: managerInfoAddress,
    incept: inceptAccountAddress,
    managerInceptUser: managerInfo.userAccount,
    usdiMint: incept.usdiMint,
    inceptProgram: managerInfo.inceptProgram,
    comet: managerInceptUser.comet,
    tokenData: incept.tokenData,
    iassetMint: pool.assetInfo.iassetMint,
    ammUsdiTokenAccount: pool.usdiTokenAccount,
    ammIassetTokenAccount: pool.iassetTokenAccount,
    liquidityTokenMint: pool.liquidityTokenMint,
    cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  return {
    withdrawCollateralFromComet,
    addCollateralToComet,
    inceptSwap,
    jupiterSwap,
    withdrawLiquidity,
    unwrapIasset,
    updatePrices,
    burnUsdi,
    mintUsdi,
    wrapAsset,
    payIld,
    addLiquidityToComet,
  };
};

const calculateIassetTrade = (
  poolUsdi: number,
  poolIasset: number,
  treasuryFee: number,
  liquidityFee: number,
  targetPrice: number
) => {
  const currentPrice = poolUsdi / poolIasset;
  const isBuy = currentPrice < targetPrice;

  let [fn, start, end] = (() => {
    if (isBuy) {
      return [
        (x: number) => {
          let res = calculateInputFromOutputFromParams(
            poolUsdi,
            poolIasset,
            treasuryFee,
            liquidityFee,
            x,
            false
          );
          return res.resultPoolUsdi / res.resultPoolIasset;
        },
        0,
        poolIasset,
      ];
    } else {
      return [
        (x: number) => {
          let res = calculateOutputFromInputFromParams(
            poolUsdi,
            poolIasset,
            treasuryFee,
            liquidityFee,
            x,
            false
          );
          return res.resultPoolUsdi / res.resultPoolIasset;
        },
        poolUsdi,
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
  managerInceptUser: User,
  incept: Incept,
  inceptAccountAddress: PublicKey,
  tokenData: TokenData,
  comet: Comet,
  jupiter: Jupiter,
  jupiterProgramId: PublicKey,
  jupiterAddress: PublicKey,
  jupiterNonce: number,
  pricePctThreshold: number,
  addressLookupTableAccount: anchor.web3.AddressLookupTableAccount
): Promise<boolean> => {
  const conversionFactor = Math.pow(10, -DEVNET_TOKEN_SCALE);
  const poolUsdi = poolData.usdi.toNumber() * conversionFactor;
  const poolIasset = poolData.iasset.toNumber() * conversionFactor;
  const poolPrice = poolUsdi / poolIasset;
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
  const claimableUsdi = L * poolUsdi;
  const claimableIasset = L * poolIasset;
  // Estimate pool after withdrawing all liquidity
  const newPoolUsdi = poolUsdi - claimableUsdi;
  const newPoolIasset = poolIasset - claimableIasset;
  console.log("NEW POOL AMOUNTS:", newPoolUsdi, newPoolIasset);
  // Figure out how much reward is gained, where to sell if in iasset.
  // Figure out how much ILD is owed.
  const iassetILD = toNumber(cometPosition.borrowedIasset) - claimableIasset;
  const usdiILD = toNumber(cometPosition.borrowedUsdi) - claimableUsdi;
  console.log("ILD/REWARD:", usdiILD, iassetILD);
  // Figure out how much buy/sell is needed to push price to oracle. NOTE that this will be arbed.
  // Use simple invariant equation for now. Positive means buy.
  const iassetInceptTrade = (() => {
    if (newPoolUsdi > 0 && newPoolIasset > 0) {
      return calculateIassetTrade(
        newPoolUsdi,
        newPoolIasset,
        treasuryFee,
        liquidityFee,
        oraclePrice
      );
    }
    return 0;
  })();
  // For other side of arb trade, always perform the opposite action but net the iasset ILD/reward.
  const jupiterExchangeTrade = -iassetInceptTrade + iassetILD;
  console.log("TRADES:", iassetInceptTrade, jupiterExchangeTrade);

  const ixnAccounts = getInstructionAccounts(
    poolId,
    incept,
    inceptAccountAddress,
    managerInfo,
    managerAddresses,
    managerInfoAddress,
    managerInceptUser,
    tokenData,
    treasuryAddresses,
    jupiter,
    jupiterAddress,
    jupiterProgramId
  );

  let instructions: TransactionInstruction[] = [
    // Update prices instruction.
    updatePricesInstructionCreate(
      inceptAccountAddress,
      incept.tokenData,
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
    // If buying on incept:
    if (iassetInceptTrade > 0) {
      // Estimate required USDi
      const execution = calculateExecutionThresholdFromParams(
        iassetInceptTrade,
        true,
        newPoolUsdi,
        newPoolIasset,
        treasuryFee,
        liquidityFee,
        0.0005
      );
      const usdiToWithdraw = execution.expectedUsdiAmount - claimableUsdi;
      // Withdraw USDi from collateral
      if (usdiToWithdraw > 0) {
        instructions.push(
          createWithdrawCollateralFromCometInstruction(
            ixnAccounts.withdrawCollateralFromComet,
            {
              amount: toDevnetScale(usdiToWithdraw),
            } as WithdrawCollateralFromCometInstructionArgs
          )
        );
      }
      // Buy Iasset on incept
      instructions.push(
        createInceptSwapInstruction(ixnAccounts.inceptSwap, {
          isBuy: true,
          poolIndex: poolId,
          amount: toDevnetScale(iassetInceptTrade),
          usdiThreshold: toDevnetScale(execution.usdiThresholdAmount),
        } as InceptSwapInstructionArgs)
      );
    }
    // convert to asset
    instructions.push(
      createUnwrapIassetInstruction(ixnAccounts.unwrapIasset, {
        amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
        poolIndex: poolId,
      } as UnwrapIassetInstructionArgs)
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
      createMintUsdiInstruction(ixnAccounts.mintUsdi, {
        amount: toDevnetScale(saleUsdAmount),
      } as MintUsdiInstructionArgs)
    );
    // Deposit USDi to collateral, subtract any USDi required for payILD
    const collateralDeposit = saleUsdAmount - Math.max(0, usdiILD);
    instructions.push(
      createAddCollateralToCometInstruction(ixnAccounts.addCollateralToComet, {
        amount: toDevnetScale(collateralDeposit),
      } as AddCollateralToCometInstructionArgs)
    );
  } else {
    // SCENARIO 2
    // Estimate required USDC for trade, net the reward from USDi
    const requiredUsdc = jupiterExchangeTrade * toNumber(pool.assetInfo.price);
    const usdiToWithdraw = requiredUsdc - claimableUsdi;
    console.log(requiredUsdc, jupiterExchangeTrade, usdiToWithdraw);
    if (usdiToWithdraw > 0) {
      // Withdraw USDi from collateral
      instructions.push(
        createWithdrawCollateralFromCometInstruction(
          ixnAccounts.withdrawCollateralFromComet,
          {
            amount: toDevnetScale(usdiToWithdraw),
          } as WithdrawCollateralFromCometInstructionArgs
        )
      );
    }
    // Convert USDi -> USDC
    instructions.push(
      createBurnUsdiInstruction(ixnAccounts.burnUsdi, {
        amount: toDevnetScale(requiredUsdc),
      } as BurnUsdiInstructionArgs)
    );
    // buy underlying asset on jupiter
    instructions.push(
      createJupiterMockSwapInstruction(ixnAccounts.jupiterSwap, {
        jupiterNonce,
        isBuy: true,
        assetIndex: poolId,
        amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
      } as JupiterMockSwapInstructionArgs)
    );
    // Convert from underlying to iasset.
    instructions.push(
      createWrapAssetInstruction(ixnAccounts.wrapAsset, {
        amount: toDevnetScale(Math.abs(jupiterExchangeTrade)),
        poolIndex: poolId,
      } as WrapAssetInstructionArgs)
    );
    // Convert the iasset thats not used for Paying ILD to usdi and deposit it.
    if (Math.abs(iassetInceptTrade) > 0) {
      // sell on incept
      const execution = calculateExecutionThresholdFromParams(
        Math.abs(iassetInceptTrade),
        false,
        newPoolUsdi,
        newPoolIasset,
        treasuryFee,
        liquidityFee,
        0.005
      );
      instructions.push(
        createInceptSwapInstruction(ixnAccounts.inceptSwap, {
          isBuy: false,
          poolIndex: poolId,
          amount: toDevnetScale(Math.abs(iassetInceptTrade)),
          usdiThreshold: toDevnetScale(execution.usdiThresholdAmount),
        } as InceptSwapInstructionArgs)
      );
      // Deposit USDi to collateral
      instructions.push(
        createAddCollateralToCometInstruction(
          ixnAccounts.addCollateralToComet,
          {
            amount: toDevnetScale(execution.expectedUsdiAmount),
          } as AddCollateralToCometInstructionArgs
        )
      );
    }
  }
  let collateralAmount = usdiILD > 0 ? usdiILD : iassetILD;
  if (collateralAmount > 0) {
    // Pay ILD
    instructions.push(
      createPayIldInstruction(ixnAccounts.payIld, {
        cometPositionIndex,
        payUsdiDebt: usdiILD > 0,
        collateralAmount: toDevnetScale(collateralAmount),
      } as PayIldInstructionArgs)
    );
  }

  // Add liquidity
  const usdiToAdd = L < 1 ? (L * newPoolUsdi) / (1 - L) : poolUsdi;
  console.log("LIQUIDITY TO ADD:", poolUsdi);
  instructions.push(
    createAddLiquidityInstruction(ixnAccounts.addLiquidityToComet, {
      poolIndex: poolId,
      usdiAmount: toDevnetScale(usdiToAdd),
    } as AddLiquidityInstructionArgs)
  );
  // Create versioned transaction and send
  const { blockhash } = await provider.connection.getLatestBlockhash(
    "finalized"
  );
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
  let config = {
    inceptProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    inceptCometManager: new PublicKey(process.env.COMET_MANAGER_PROGRAM_ID!),
    jupiterProgramId: new PublicKey(process.env.JUPITER_PROGRAM_ID!),
    lookupTableAddress: new PublicKey(process.env.LOOKUP_TABLE_ADDRESS!),
    pctThreshold: Number(process.env.PCT_THRESHOLD!)// 0.01,
  };
  const provider = anchor.AnchorProvider.env();

  const [inceptAccountAddress, _inceptNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("incept")],
    config.inceptProgramID
  );

  const [cometManagerAccountAddress, _cometManagerNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("manager-info"), provider.publicKey!.toBuffer()],
      config.inceptCometManager
    );

  const [jupiterAccountAddress, jupiterNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("jupiter")],
      config.jupiterProgramId
    );

  const [userAccountAddress, _inceptUserNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), cometManagerAccountAddress.toBuffer()],
      config.inceptProgramID
    );

  const incept = await Incept.fromAccountAddress(
    provider.connection,
    inceptAccountAddress
  );

  const userAccount = await User.fromAccountAddress(
    provider.connection,
    userAccountAddress
  );

  const inceptProgram = new anchor.Program<InceptProgram>(
    InceptIDL,
    config.inceptProgramID,
    provider
  );

  const managerProgram = new anchor.Program<InceptCometManager>(
    InceptCometManagerIDL,
    config.inceptCometManager,
    provider
  );

  // Market state objects
  let pythPrices: PythPriceData = new Map();
  pythPrices.set(0, 1); // FOR TESTING!
  let poolStates: PoolStateData = new Map();
  // Current manager state
  let managerState = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerAccountAddress
  );

  let tokenData = await TokenData.fromAccountAddress(
    provider.connection,
    incept.tokenData
  );
  let comet = await Comet.fromAccountAddress(
    provider.connection,
    userAccount.comet
  );
  console.log("USDI mint:", incept.usdiMint.toString());
  console.log(
    "COMET:",
    comet.numPositions.toNumber(),
    comet.numCollaterals.toNumber(),
    toNumber(comet.collaterals[0].collateralAmount),
    toNumber(comet.positions[0].borrowedUsdi)
  );
  let jupiter = await Jupiter.fromAccountAddress(
    provider.connection,
    jupiterAccountAddress
  );

  const managerAddresses = await getManagerTokenAccountAddresses(
    provider,
    cometManagerAccountAddress,
    tokenData,
    incept.usdiMint,
    jupiter.usdcMint,
    jupiter.assetMints.slice(0, jupiter.nAssets)
  );

  const treasuryAddresses = await getTreasuryTokenAccountAddresses(
    provider,
    incept.treasuryAddress,
    tokenData,
    incept.usdiMint,
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
  inceptProgram.account.tokenData
    .subscribe(incept.tokenData, "recent")
    .on("change", (account: TokenData) => {
      tokenData = account;
    });
  inceptProgram.account.comet
    .subscribe(userAccount.comet, "recent")
    .on("change", (account: Comet) => {
      comet = account;
    });

  console.log("SUBSCRIBING!");
  let executing = false;
  // Setup pool listening
  inceptProgram.addEventListener(
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
          incept,
          inceptAccountAddress,
          tokenData,
          comet,
          jupiter,
          config.jupiterProgramId,
          jupiterAccountAddress,
          jupiterNonce,
          config.pctThreshold,
          altAccount
        ).then((result) => {
          console.log("Algorithm ran:", result);
          executing = false;
        });
      }
    }
  );

  // Setup Pyth listening, NOTE: this is relevant for devnet only.
  // TODO: Refactor to extract the price only.
  // Once we switch away from using Jupiter Mock Agg into the real jupiter we'll have to
  // figure out either streaming or polling quotes from Jupiter for our specific routes.
  // const pythConnection = new PythConnection(
  //   provider.connection,
  //   getPythProgramKeyForCluster("devnet")
  // );
  // pythConnection.onPriceChange((product, data) => {
  //   let poolIndex = PYTH_SYMBOL_MAPPING.get(product.symbol);
  //   if (poolIndex === undefined) return;
  //   pythPrices.set(poolIndex, data.price!)
  //   if (!executing) {
  //     executing = true;
  //     onPriceChangeUpdate(
  //       provider,
  //       poolIndex,
  //       pythPrices.get(poolIndex)!,
  //       poolStates.get(poolIndex)!,
  //       managerState,
  //       cometManagerAccountAddress,
  //       managerAddresses,
  //       treasuryAddresses,
  //       userAccount,
  //       incept,
  //       inceptAccountAddress,
  //       tokenData,
  //       comet,
  //       jupiter,
  //       config.jupiterProgramId,
  //       jupiterAccountAddress,
  //       jupiterNonce,
  //       config.pctThreshold,
  //       altAccount
  //     ).then((result) => {
  //       console.log("Algorithm ran:", result);
  //       executing = false
  //     })
  //   }
  // });
  // // Start listening for price change events.
  // await pythConnection.start();
};

main();
