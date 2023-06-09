import { toNumber, convertToDecimal, getMantissa } from "./decimal";
import { CloneClient, DEVNET_TOKEN_SCALE, toDevnetScale } from "./clone";
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
  calculateNewSinglePoolCometFromOnusdBorrowed,
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
  isInputOnusd: boolean
) => {
  const treasuryFeeRate = toNumber(pool.treasuryTradingFee);
  const totalFeeRate = toNumber(pool.liquidityTradingFee) + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;

  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const invariant = poolOnasset * poolOnusd;

  let resultPool = deepCopy(pool);

  const outputBeforeFees = isInputOnusd
    ? poolOnasset - invariant / (poolOnusd + input)
    : poolOnusd - invariant / (poolOnasset + input);
  const output = floorToDevnetScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  if (isInputOnusd) {
    resultPool.onusdAmount = convertToDecimal(
      toNumber(resultPool.onusdAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      toNumber(resultPool.onassetAmount) - output - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    resultPool.onusdAmount = convertToDecimal(
      toNumber(resultPool.onusdAmount) - output - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      toNumber(resultPool.onassetAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  }
  return { output, resultPool };
};

export const calculateOutputFromInputFromParams = (
  poolOnusd: number,
  poolOnasset: number, 
  treasuryFeeRate: number,
  liquidityTradingFeeRate: number,
  input: number,
  isInputOnusd: boolean
) => {
  const totalFeeRate = liquidityTradingFeeRate + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;
  const invariant = poolOnasset * poolOnusd;

  const outputBeforeFees = isInputOnusd
    ? poolOnasset - invariant / (poolOnusd + input)
    : poolOnusd - invariant / (poolOnasset + input);
  const output = floorToDevnetScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const [resultPoolOnusd, resultPoolOnasset] = (() => {
    if (isInputOnusd) {
      return [
        poolOnusd + input,
        poolOnasset - output - treasuryFee
      ]
    } else {
      return [
        poolOnusd - output - treasuryFee,
        poolOnasset + input
      ]
    }
  })()

  return { output, resultPoolOnusd, resultPoolOnasset };
};

export const calculateInputFromOutput = (
  pool: Pool,
  output: number,
  isOutputOnusd: boolean
) => {
  const treasuryFeeRate = toNumber(pool.treasuryTradingFee);
  const totalFeeRate = toNumber(pool.liquidityTradingFee) + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;

  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const invariant = poolOnasset * poolOnusd;

  const outputBeforeFees = output / feeAdjustment;
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floorToDevnetScale(
    isOutputOnusd
      ? invariant / (poolOnusd - outputBeforeFees) - poolOnasset
      : invariant / (poolOnasset - outputBeforeFees) - poolOnusd
  );
  let resultPool = deepCopy(pool);

  if (isOutputOnusd) {
    resultPool.onusdAmount = convertToDecimal(
      toNumber(pool.onusdAmount) - outputBeforeFees - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      toNumber(pool.onassetAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    resultPool.onusdAmount = convertToDecimal(
      toNumber(pool.onusdAmount) + input,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      toNumber(pool.onassetAmount) - outputBeforeFees - treasuryFee,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  }
  return { input, resultPool };
};

export const calculateInputFromOutputFromParams = (
  poolOnusd: number,
  poolOnasset: number, 
  treasuryFeeRate: number,
  liquidityTradingFeeRate: number,
  output: number,
  isOutputOnusd: boolean
) => {
  const totalFeeRate = liquidityTradingFeeRate + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;
  const invariant = poolOnasset * poolOnusd;

  const outputBeforeFees = output / feeAdjustment;
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floorToDevnetScale(
    isOutputOnusd
      ? invariant / (poolOnusd - outputBeforeFees) - poolOnasset
      : invariant / (poolOnasset - outputBeforeFees) - poolOnusd
  );
  const [resultPoolOnusd, resultPoolOnasset] = (() => {
    if (isOutputOnusd) {
      return [
        poolOnusd - outputBeforeFees - treasuryFee,
        poolOnasset + input
      ]
    } else {
      return [
        poolOnusd + input,
        poolOnasset - outputBeforeFees - treasuryFee,
      ]
    }
  })()
  return { input, resultPoolOnusd, resultPoolOnasset };
};

export const calculateExecutionThreshold = (
  onassetAmount: number,
  isBuy: boolean,
  pool: Pool,
  slippage: number
): {
  expectedOnusdAmount: number;
  onusdThresholdAmount: number;
  expectedPrice: number;
  thresholdPrice: number;
} => {
  let expectedOnusdAmount;
  let onusdThresholdAmount;
  if (isBuy) {
    expectedOnusdAmount = calculateInputFromOutput(
      pool,
      onassetAmount,
      false
    ).input;
    onusdThresholdAmount = expectedOnusdAmount / (1 - slippage);
  } else {
    expectedOnusdAmount = calculateOutputFromInput(
      pool,
      onassetAmount,
      false
    ).output;
    onusdThresholdAmount = expectedOnusdAmount * (1 - slippage);
  }

  return {
    expectedOnusdAmount: floorToDevnetScale(expectedOnusdAmount),
    onusdThresholdAmount: floorToDevnetScale(onusdThresholdAmount),
    expectedPrice: floorToDevnetScale(expectedOnusdAmount / onassetAmount),
    thresholdPrice: floorToDevnetScale(onusdThresholdAmount / onassetAmount),
  };
};


export const calculateExecutionThresholdFromParams = (
  onassetAmount: number,
  isBuy: boolean,
  poolOnusd: number,
  poolOnasset: number,
  treasuryTradingFee: number,
  liquidityTradingFee: number,
  slippage: number
): {
  expectedOnusdAmount: number;
  onusdThresholdAmount: number;
  expectedPrice: number;
  thresholdPrice: number;
} => {
  let expectedOnusdAmount;
  let onusdThresholdAmount;
  if (isBuy) {
    expectedOnusdAmount = calculateInputFromOutputFromParams(
      poolOnusd,
      poolOnasset,
      treasuryTradingFee,
      liquidityTradingFee,
      onassetAmount,
      false
    ).input;
    onusdThresholdAmount = expectedOnusdAmount / (1 - slippage);
  } else {
    expectedOnusdAmount = calculateOutputFromInputFromParams(
      poolOnusd,
      poolOnasset,
      treasuryTradingFee,
      liquidityTradingFee,
      onassetAmount,
      false
    ).output;
    onusdThresholdAmount = expectedOnusdAmount * (1 - slippage);
  }

  return {
    expectedOnusdAmount: floorToDevnetScale(expectedOnusdAmount),
    onusdThresholdAmount: floorToDevnetScale(onusdThresholdAmount),
    expectedPrice: floorToDevnetScale(expectedOnusdAmount / onassetAmount),
    thresholdPrice: floorToDevnetScale(onusdThresholdAmount / onassetAmount),
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
  const x = toNumber(pool.onassetAmount);
  const y = toNumber(pool.onusdAmount);
  const currentPoolPrice = y / x;

  if (
    (isBuy && priceLimit <= currentPoolPrice) ||
    (!isBuy && priceLimit >= currentPoolPrice) ||
    amount <= 0
  )
    return 0;

  const calcExecutionPrice = (onassetAmount: number) => {
    return isBuy
      ? calculateInputFromOutput(pool, onassetAmount, false).input / onassetAmount
      : calculateOutputFromInput(pool, onassetAmount, false).output /
          onassetAmount;
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
    // Guess the amount of Onasset we can buy/sell
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
  const poolOnusd = toNumber(pool.onusdAmount);
  const poolOnasset = toNumber(pool.onassetAmount);
  const L = lpTokens / lpSupply;
  if (isWithdraw) {
    const claimableOnusd = L * poolOnusd;
    const claimableOnasset = L * poolOnasset;
    resultPool.onusdAmount = convertToDecimal(
      poolOnusd - claimableOnusd,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      poolOnasset - claimableOnasset,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.liquidityTokenSupply = convertToDecimal(
      lpSupply - lpTokens,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    const addedOnusd = L * poolOnusd;
    const addedOnasset = L * poolOnasset;
    resultPool.onusdAmount = convertToDecimal(
      poolOnusd + addedOnusd,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      poolOnasset + addedOnasset,
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
  clone: CloneClient,
  comet: Comet,
  tokenData: TokenData,
  positionIndex: number,
  onusdTokenAccountInfo: PublicKey,
  onassetTokenAccountInfo: PublicKey,
  treasuryOnusdTokenAccount: PublicKey,
  treasuryOnassetTokenAccount: PublicKey
): {
  healthScore: number;
  onusdCost: number;
  ixs: Promise<TransactionInstruction>[];
  upperPrice?: number;
  lowerPrice?: number;
} => {
  let ixs: Promise<TransactionInstruction>[] = [
    clone.updatePricesInstruction(),
  ];
  const isSinglePool = comet.isSinglePool.toNumber() === 1;
  const cometPosition = deepCopy(comet.positions[positionIndex]);
  const lpTokens = toNumber(cometPosition.liquidityTokenValue);
  const poolIndex = cometPosition.poolIndex;
  const pool = deepCopy(tokenData.pools[cometPosition.poolIndex]);

  // Need to withdraw all liquidity from comet.
  ixs.push(
    clone.withdrawLiquidityFromCometInstruction(
      toDevnetScale(lpTokens),
      positionIndex,
      onassetTokenAccountInfo,
      onusdTokenAccountInfo,
      isSinglePool
    )
  );

  // Either buy or sell onasset depending on additional reward.
  const L =
    toNumber(cometPosition.liquidityTokenValue) /
    toNumber(pool.liquidityTokenSupply);
  const claimableOnusd = floorToDevnetScale(L * toNumber(pool.onusdAmount));
  const claimableOnasset = floorToDevnetScale(L * toNumber(pool.onassetAmount));
  const surplusOnusd =
    claimableOnusd - floorToDevnetScale(toNumber(cometPosition.borrowedOnusd));
  const surplusOnasset =
    claimableOnasset -
    floorToDevnetScale(toNumber(cometPosition.borrowedOnasset));
  const currentPoolPrice =
    toNumber(pool.onusdAmount) / toNumber(pool.onassetAmount);

  let recenterPool = resultantPool(
    pool,
    toNumber(cometPosition.liquidityTokenValue),
    true
  );
  // TODO: Optimize by splitting across exchanges with Jupiter.
  const absOnassetAmount = Math.abs(surplusOnasset);
  let onusdCost = -surplusOnusd; // Only need to add/sub based on onasset trading.

  if (surplusOnasset > 0) {
    // Want to sell surplus.
    ixs.push(
      clone.sellOnassetInstruction(
        onusdTokenAccountInfo,
        onassetTokenAccountInfo,
        toDevnetScale(absOnassetAmount),
        poolIndex,
        toDevnetScale((currentPoolPrice * Math.abs(surplusOnasset)) / 1.5),
        treasuryOnusdTokenAccount
      )
    );
    let { output, resultPool } = calculateOutputFromInput(
      recenterPool,
      surplusOnasset,
      false
    );
    onusdCost -= output;
    recenterPool = deepCopy(resultPool);
  } else if (surplusOnasset < 0) {
    // Want to buy deficit.
    ixs.push(
      clone.buyOnassetInstruction(
        onusdTokenAccountInfo,
        onassetTokenAccountInfo,
        toDevnetScale(absOnassetAmount),
        poolIndex,
        toDevnetScale(currentPoolPrice * Math.abs(surplusOnasset) * 1.5),
        treasuryOnassetTokenAccount
      )
    );
    let { input, resultPool } = calculateInputFromOutput(
      recenterPool,
      absOnassetAmount,
      false
    );
    onusdCost += input;
    recenterPool = deepCopy(resultPool);
    // Pay Onasset ILD
    ixs.push(
      clone.payCometILDInstruction(
        positionIndex,
        toDevnetScale(absOnassetAmount),
        false,
        onassetTokenAccountInfo,
        onusdTokenAccountInfo,
        isSinglePool
      )
    );
  }
  // Pay onUSD ILD
  if (surplusOnusd < 0) {
    ixs.push(
      clone.payCometILDInstruction(
        positionIndex,
        toDevnetScale(Math.abs(surplusOnusd)),
        true,
        onassetTokenAccountInfo,
        onusdTokenAccountInfo,
        isSinglePool
      )
    );
  }
  // Deploy capital to the same amount of liquidity tokens.
  let Lnew =
    toNumber(cometPosition.liquidityTokenValue) /
    toNumber(recenterPool.liquidityTokenSupply);
  let onusdToDeploy = Lnew * toNumber(recenterPool.onusdAmount);
  let onassetToDeploy = Lnew * toNumber(recenterPool.onassetAmount);

  ixs.push(
    isSinglePool
      ? clone.addLiquidityToSinglePoolCometInstruction(
          toDevnetScale(onusdToDeploy),
          positionIndex,
          poolIndex
        )
      : clone.addLiquidityToCometInstruction(
          toDevnetScale(onusdToDeploy),
          poolIndex
        )
  );

  let resultantComet = deepCopy(comet);
  resultantComet.positions[positionIndex].borrowedOnusd = convertToDecimal(
    onusdToDeploy,
    DEVNET_TOKEN_SCALE
  ).toRawDecimal();
  resultantComet.positions[positionIndex].borrowedOnasset = convertToDecimal(
    onassetToDeploy,
    DEVNET_TOKEN_SCALE
  ).toRawDecimal();
  const cometCollateral = toNumber(
    resultantComet.collaterals[positionIndex].collateralAmount
  );

  let newPositionInfo = isSinglePool
    ? calculateNewSinglePoolCometFromOnusdBorrowed(
        poolIndex,
        cometCollateral,
        onusdToDeploy,
        tokenData
      )
    : getHealthScore(tokenData, resultantComet);

  onusdCost = Math.max(onusdCost, 0);

  return { ...newPositionInfo, ixs, onusdCost };
};
