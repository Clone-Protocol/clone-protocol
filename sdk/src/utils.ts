import { toNumber, convertToDecimal, getMantissa } from "./decimal";
import { InceptClient, DEVNET_TOKEN_SCALE, toDevnetScale } from "./incept";
import { Pool, Comet, TokenData, CometPosition } from "./interfaces";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
  VersionedTransaction,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { JupiterAggMock } from "./idl/jupiter_agg_mock";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  getHealthScore,
  calculateNewSinglePoolCometFromUsdiBorrowed,
} from "./healthscore";

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// https://javascript.plainenglish.io/deep-clone-an-object-and-preserve-its-type-with-typescript-d488c35e5574
export const deepCopy = <T>(source: T): T => {
  return Array.isArray(source)
    ? source.map((item) => deepCopy(item))
    : source instanceof Date
    ? new Date(source.getTime())
    : source && typeof source === "object"
    ? Object.getOwnPropertyNames(source).reduce((o, prop) => {
        Object.defineProperty(
          o,
          prop,
          Object.getOwnPropertyDescriptor(source, prop)!
        );
        o[prop] = deepCopy((source as { [key: string]: any })[prop]);
        return o;
      }, Object.create(Object.getPrototypeOf(source)))
    : (source as T);
};

export const floorToScale = (x: number, scale: number) => {
  return Math.floor(x * Math.pow(10, scale)) * Math.pow(10, -scale);
};

export const floorToDevnetScale = (x: number) => {
  return floorToScale(x, DEVNET_TOKEN_SCALE);
};

export const calculateMantissa = (
  x: number,
  scale: number = DEVNET_TOKEN_SCALE
) => {
  return Math.floor(x * Math.pow(10, scale));
};

export const calculateOutputFromInput = (
  pool: Pool,
  input: number,
  isInputUsdi: boolean
) => {
  const treasuryFeeRate = toNumber(pool.treasuryTradingFee);
  const totalFeeRate = toNumber(pool.liquidityTradingFee) + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;

  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const invariant = poolIasset * poolUsdi;

  let resultPool = deepCopy(pool);

  const outputBeforeFees = isInputUsdi
    ? poolIasset - invariant / (poolUsdi + input)
    : poolUsdi - invariant / (poolIasset + input);
  const output = floorToDevnetScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  if (isInputUsdi) {
    resultPool.usdiAmount = convertToDecimal(
      toNumber(resultPool.usdiAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.iassetAmount = convertToDecimal(
      toNumber(resultPool.iassetAmount) - output - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    resultPool.usdiAmount = convertToDecimal(
      toNumber(resultPool.usdiAmount) - output - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.iassetAmount = convertToDecimal(
      toNumber(resultPool.iassetAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  }
  return { output, resultPool };
};

export const calculateInputFromOutput = (
  pool: Pool,
  output: number,
  isOutputUsdi: boolean
) => {
  const treasuryFeeRate = toNumber(pool.treasuryTradingFee);
  const totalFeeRate = toNumber(pool.liquidityTradingFee) + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;

  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const invariant = poolIasset * poolUsdi;

  const outputBeforeFees = output / feeAdjustment;
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floorToDevnetScale(
    isOutputUsdi
      ? invariant / (poolUsdi - outputBeforeFees) - poolIasset
      : invariant / (poolIasset - outputBeforeFees) - poolUsdi
  );
  let resultPool = deepCopy(pool);

  if (isOutputUsdi) {
    resultPool.usdiAmount = convertToDecimal(
      toNumber(pool.usdiAmount) - outputBeforeFees - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.iassetAmount = convertToDecimal(
      toNumber(pool.iassetAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    resultPool.usdiAmount = convertToDecimal(
      toNumber(pool.usdiAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.iassetAmount = convertToDecimal(
      toNumber(pool.iassetAmount) - outputBeforeFees - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  }
  return { input, resultPool };
};

export const calculateExecutionThreshold = (
  iassetAmount: number,
  isBuy: boolean,
  pool: Pool,
  slippage: number
): {
  expectedUsdiAmount: number;
  usdiThresholdAmount: number;
  expectedPrice: number;
  thresholdPrice: number;
} => {
  let expectedUsdiAmount;
  let usdiThresholdAmount;
  if (isBuy) {
    expectedUsdiAmount = calculateInputFromOutput(
      pool,
      iassetAmount,
      false
    ).input;
    usdiThresholdAmount = expectedUsdiAmount / (1 - slippage);
  } else {
    expectedUsdiAmount = calculateOutputFromInput(
      pool,
      iassetAmount,
      false
    ).output;
    usdiThresholdAmount = expectedUsdiAmount * (1 - slippage);
  }

  return {
    expectedUsdiAmount: floorToDevnetScale(expectedUsdiAmount),
    usdiThresholdAmount: floorToDevnetScale(usdiThresholdAmount),
    expectedPrice: floorToDevnetScale(expectedUsdiAmount / iassetAmount),
    thresholdPrice: floorToDevnetScale(usdiThresholdAmount / iassetAmount),
  };
};

// Estimates how much of the `amount` we can actually execute at a better price than `priceLimit`
// Should extend this to exclude `amount` and just give us the most we can execute.
export const executionCapacity = (
  pool: Pool,
  isBuy: boolean,
  priceLimit: number,
  amount: number
) => {
  const x = toNumber(pool.iassetAmount);
  const y = toNumber(pool.usdiAmount);
  const currentPoolPrice = y / x;

  if (
    (isBuy && priceLimit <= currentPoolPrice) ||
    (!isBuy && priceLimit >= currentPoolPrice) ||
    amount <= 0
  )
    return 0;

  const calcExecutionPrice = (iassetAmount: number) => {
    return isBuy
      ? calculateInputFromOutput(pool, iassetAmount, false).input / iassetAmount
      : calculateOutputFromInput(pool, iassetAmount, false).output /
          iassetAmount;
  };

  const fullExecutionPrice = calcExecutionPrice(amount);

  if (
    (isBuy && fullExecutionPrice <= priceLimit) ||
    (!isBuy && fullExecutionPrice >= priceLimit)
  )
    return amount;

  const maxIterations = 10000;
  const tol = Math.pow(10, -DEVNET_TOKEN_SCALE);

  return (() => {
    // Guess the amount of iAsset we can buy/sell
    let [leftGuess, rightGuess] = isBuy ? [0, amount] : [amount, 0];
    let midpointGuess = (leftGuess + rightGuess) * 0.5;

    for (let i = 0; i < maxIterations; i++) {
      if (Math.abs(leftGuess - rightGuess) < tol) {
        return leftGuess;
      }
      let midpointPrice = calcExecutionPrice(midpointGuess);
      if (midpointPrice < priceLimit) {
        leftGuess = midpointGuess;
      } else {
        rightGuess = midpointGuess;
      }
      midpointGuess = (leftGuess + rightGuess) * 0.5;
    }
    throw new Error("Max iterations reached!");
  })();
};

export const createTx = async (
  instructionCalls: Promise<Transaction | TransactionInstruction>[]
): Promise<Transaction> => {
  let tx = new Transaction();
  let ixns = await Promise.all(instructionCalls);
  ixns.forEach((ix) => tx.add(ix));
  return tx;
};

export const createVersionedTx = (
  payer: PublicKey,
  blockhash: string,
  txn: Transaction,
  lookupTableAccounts: AddressLookupTableAccount[] | AddressLookupTableAccount
) => {
  if (!Array.isArray(lookupTableAccounts)) {
    lookupTableAccounts = [lookupTableAccounts];
  }
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: txn.instructions,
  }).compileToV0Message(lookupTableAccounts);
  // create a v0 transaction from the v0 message
  const transactionV0 = new VersionedTransaction(messageV0);
  return transactionV0;
};

export const resultantPool = (
  pool: Pool,
  lpTokens: number,
  isWithdraw: boolean
): Pool => {
  let resultPool = deepCopy(pool);
  const lpSupply = toNumber(pool.liquidityTokenSupply);
  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const L = lpTokens / lpSupply;
  if (isWithdraw) {
    const claimableUsdi = L * poolUsdi;
    const claimableIasset = L * poolIasset;
    resultPool.usdiAmount = convertToDecimal(
      poolUsdi - claimableUsdi,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.iassetAmount = convertToDecimal(
      poolIasset - claimableIasset,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.liquidityTokenSupply = convertToDecimal(
      lpSupply - lpTokens,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    const addedUsdi = L * poolUsdi;
    const addedIasset = L * poolIasset;
    resultPool.usdiAmount = convertToDecimal(
      poolUsdi + addedUsdi,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.iassetAmount = convertToDecimal(
      poolIasset + addedIasset,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.liquidityTokenSupply = convertToDecimal(
      lpSupply + lpTokens,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  }

  return resultPool;
};

// To be used for testing and devnet.
export const recenterProcedureInstructions = (
  incept: InceptClient,
  comet: Comet,
  tokenData: TokenData,
  positionIndex: number,
  usdiTokenAccountInfo: PublicKey,
  iassetTokenAccountInfo: PublicKey,
  treasuryUsdiTokenAccount: PublicKey,
  treasuryIassetTokenAccount: PublicKey
): {
  healthScore: number;
  usdiCost: number;
  ixs: Promise<TransactionInstruction>[];
  upperPrice?: number;
  lowerPrice?: number;
} => {
  let ixs: Promise<TransactionInstruction>[] = [
    incept.updatePricesInstruction(),
  ];
  const isSinglePool = comet.isSinglePool.toNumber() === 1;
  const cometPosition = deepCopy(comet.positions[positionIndex]);
  const lpTokens = toNumber(cometPosition.liquidityTokenValue);
  const poolIndex = cometPosition.poolIndex;
  const pool = deepCopy(tokenData.pools[cometPosition.poolIndex]);

  // Need to withdraw all liquidity from comet.
  ixs.push(
    incept.withdrawLiquidityFromCometInstruction(
      toDevnetScale(lpTokens),
      positionIndex,
      iassetTokenAccountInfo,
      usdiTokenAccountInfo,
      isSinglePool
    )
  );

  // Either buy or sell iasset depending on additional reward.
  const L =
    toNumber(cometPosition.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);
  const claimableUsdi = floorToDevnetScale(L * toNumber(pool.usdiAmount));
  const claimableIasset = floorToDevnetScale(L * toNumber(pool.iassetAmount));
  const surplusUsdi =
    claimableUsdi - floorToDevnetScale(toNumber(cometPosition.borrowedUsdi));
  const surplusIasset =
    claimableIasset -
    floorToDevnetScale(toNumber(cometPosition.borrowedIasset));
  const currentPoolPrice =
    toNumber(pool.usdiAmount) / toNumber(pool.iassetAmount);

  let recenterPool = resultantPool(
    pool,
    toNumber(cometPosition.liquidityTokenValue),
    true
  );
  // TODO: Optimize by splitting across exchanges with Jupiter.
  const absIassetAmount = Math.abs(surplusIasset);
  let usdiCost = -surplusUsdi; // Only need to add/sub based on iasset trading.

  if (surplusIasset > 0) {
    // Want to sell surplus.
    ixs.push(
      incept.sellIassetInstruction(
        usdiTokenAccountInfo,
        iassetTokenAccountInfo,
        toDevnetScale(absIassetAmount),
        poolIndex,
        toDevnetScale((currentPoolPrice * Math.abs(surplusIasset)) / 1.5),
        treasuryUsdiTokenAccount
      )
    );
    let { output, resultPool } = calculateOutputFromInput(
      recenterPool,
      surplusIasset,
      false
    );
    usdiCost -= output;
    recenterPool = deepCopy(resultPool);
  } else if (surplusIasset < 0) {
    // Want to buy deficit.
    ixs.push(
      incept.buyIassetInstruction(
        usdiTokenAccountInfo,
        iassetTokenAccountInfo,
        toDevnetScale(absIassetAmount),
        poolIndex,
        toDevnetScale(currentPoolPrice * Math.abs(surplusIasset) * 1.5),
        treasuryIassetTokenAccount
      )
    );
    let { input, resultPool } = calculateInputFromOutput(
      recenterPool,
      absIassetAmount,
      false
    );
    usdiCost += input;
    recenterPool = deepCopy(resultPool);
    // Pay Iasset ILD
    ixs.push(
      incept.payCometILDInstruction(
        positionIndex,
        toDevnetScale(absIassetAmount),
        false,
        iassetTokenAccountInfo,
        usdiTokenAccountInfo,
        isSinglePool
      )
    );
  }
  // Pay USDi ILD
  if (surplusUsdi < 0) {
    ixs.push(
      incept.payCometILDInstruction(
        positionIndex,
        toDevnetScale(Math.abs(surplusUsdi)),
        true,
        iassetTokenAccountInfo,
        usdiTokenAccountInfo,
        isSinglePool
      )
    );
  }
  // Deploy capital to the same amount of liquidity tokens.
  let Lnew =
    toNumber(cometPosition.liquidityTokenValue) /
    toNumber(recenterPool.liquidityTokenSupply);
  let usdiToDeploy = Lnew * toNumber(recenterPool.usdiAmount);
  let iassetToDeploy = Lnew * toNumber(recenterPool.iassetAmount);

  ixs.push(
    isSinglePool
      ? incept.addLiquidityToSinglePoolCometInstruction(
          toDevnetScale(usdiToDeploy),
          positionIndex,
          poolIndex
        )
      : incept.addLiquidityToCometInstruction(
          toDevnetScale(usdiToDeploy),
          poolIndex
        )
  );

  let resultantComet = deepCopy(comet);
  resultantComet.positions[positionIndex].borrowedUsdi = convertToDecimal(
    usdiToDeploy,
    DEVNET_TOKEN_SCALE
  ).toRawDecimal();
  resultantComet.positions[positionIndex].borrowedIasset = convertToDecimal(
    iassetToDeploy,
    DEVNET_TOKEN_SCALE
  ).toRawDecimal();
  const cometCollateral = toNumber(
    resultantComet.collaterals[positionIndex].collateralAmount
  );

  let newPositionInfo = isSinglePool
    ? calculateNewSinglePoolCometFromUsdiBorrowed(
        poolIndex,
        cometCollateral,
        usdiToDeploy,
        tokenData
      )
    : getHealthScore(tokenData, resultantComet);

  usdiCost = Math.max(usdiCost, 0);

  return { ...newPositionInfo, ixs, usdiCost };
};
