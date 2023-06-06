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
  calculateNewSinglePoolCometFromOnUsdBorrowed,
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
  isInputOnUsd: boolean
) => {
  const treasuryFeeRate = toNumber(pool.treasuryTradingFee);
  const totalFeeRate = toNumber(pool.liquidityTradingFee) + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;

  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const invariant = poolOnAsset * poolOnUsd;

  let resultPool = deepCopy(pool);

  const outputBeforeFees = isInputOnUsd
    ? poolOnAsset - invariant / (poolOnUsd + input)
    : poolOnUsd - invariant / (poolOnAsset + input);
  const output = floorToDevnetScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  if (isInputOnUsd) {
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
  poolOnUsd: number,
  poolOnAsset: number, 
  treasuryFeeRate: number,
  liquidityTradingFeeRate: number,
  input: number,
  isInputOnUsd: boolean
) => {
  const totalFeeRate = liquidityTradingFeeRate + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;
  const invariant = poolOnAsset * poolOnUsd;

  const outputBeforeFees = isInputOnUsd
    ? poolOnAsset - invariant / (poolOnUsd + input)
    : poolOnUsd - invariant / (poolOnAsset + input);
  const output = floorToDevnetScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const [resultPoolOnUsd, resultPoolOnAsset] = (() => {
    if (isInputOnUsd) {
      return [
        poolOnUsd + input,
        poolOnAsset - output - treasuryFee
      ]
    } else {
      return [
        poolOnUsd - output - treasuryFee,
        poolOnAsset + input
      ]
    }
  })()

  return { output, resultPoolOnUsd, resultPoolOnAsset };
};

export const calculateInputFromOutput = (
  pool: Pool,
  output: number,
  isOutputOnUsd: boolean
) => {
  const treasuryFeeRate = toNumber(pool.treasuryTradingFee);
  const totalFeeRate = toNumber(pool.liquidityTradingFee) + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;

  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const invariant = poolOnAsset * poolOnUsd;

  const outputBeforeFees = output / feeAdjustment;
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floorToDevnetScale(
    isOutputOnUsd
      ? invariant / (poolOnUsd - outputBeforeFees) - poolOnAsset
      : invariant / (poolOnAsset - outputBeforeFees) - poolOnUsd
  );
  let resultPool = deepCopy(pool);

  if (isOutputOnUsd) {
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
  poolOnUsd: number,
  poolOnAsset: number, 
  treasuryFeeRate: number,
  liquidityTradingFeeRate: number,
  output: number,
  isOutputOnUsd: boolean
) => {
  const totalFeeRate = liquidityTradingFeeRate + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;
  const invariant = poolOnAsset * poolOnUsd;

  const outputBeforeFees = output / feeAdjustment;
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floorToDevnetScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floorToDevnetScale(
    isOutputOnUsd
      ? invariant / (poolOnUsd - outputBeforeFees) - poolOnAsset
      : invariant / (poolOnAsset - outputBeforeFees) - poolOnUsd
  );
  const [resultPoolOnUsd, resultPoolOnAsset] = (() => {
    if (isOutputOnUsd) {
      return [
        poolOnUsd - outputBeforeFees - treasuryFee,
        poolOnAsset + input
      ]
    } else {
      return [
        poolOnUsd + input,
        poolOnAsset - outputBeforeFees - treasuryFee,
      ]
    }
  })()
  return { input, resultPoolOnUsd, resultPoolOnAsset };
};

export const calculateExecutionThreshold = (
  onassetAmount: number,
  isBuy: boolean,
  pool: Pool,
  slippage: number
): {
  expectedOnUsdAmount: number;
  onusdThresholdAmount: number;
  expectedPrice: number;
  thresholdPrice: number;
} => {
  let expectedOnUsdAmount;
  let onusdThresholdAmount;
  if (isBuy) {
    expectedOnUsdAmount = calculateInputFromOutput(
      pool,
      onassetAmount,
      false
    ).input;
    onusdThresholdAmount = expectedOnUsdAmount / (1 - slippage);
  } else {
    expectedOnUsdAmount = calculateOutputFromInput(
      pool,
      onassetAmount,
      false
    ).output;
    onusdThresholdAmount = expectedOnUsdAmount * (1 - slippage);
  }

  return {
    expectedOnUsdAmount: floorToDevnetScale(expectedOnUsdAmount),
    onusdThresholdAmount: floorToDevnetScale(onusdThresholdAmount),
    expectedPrice: floorToDevnetScale(expectedOnUsdAmount / onassetAmount),
    thresholdPrice: floorToDevnetScale(onusdThresholdAmount / onassetAmount),
  };
};


export const calculateExecutionThresholdFromParams = (
  onassetAmount: number,
  isBuy: boolean,
  poolOnUsd: number,
  poolOnAsset: number,
  treasuryTradingFee: number,
  liquidityTradingFee: number,
  slippage: number
): {
  expectedOnUsdAmount: number;
  onusdThresholdAmount: number;
  expectedPrice: number;
  thresholdPrice: number;
} => {
  let expectedOnUsdAmount;
  let onusdThresholdAmount;
  if (isBuy) {
    expectedOnUsdAmount = calculateInputFromOutputFromParams(
      poolOnUsd,
      poolOnAsset,
      treasuryTradingFee,
      liquidityTradingFee,
      onassetAmount,
      false
    ).input;
    onusdThresholdAmount = expectedOnUsdAmount / (1 - slippage);
  } else {
    expectedOnUsdAmount = calculateOutputFromInputFromParams(
      poolOnUsd,
      poolOnAsset,
      treasuryTradingFee,
      liquidityTradingFee,
      onassetAmount,
      false
    ).output;
    onusdThresholdAmount = expectedOnUsdAmount * (1 - slippage);
  }

  return {
    expectedOnUsdAmount: floorToDevnetScale(expectedOnUsdAmount),
    onusdThresholdAmount: floorToDevnetScale(onusdThresholdAmount),
    expectedPrice: floorToDevnetScale(expectedOnUsdAmount / onassetAmount),
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
    // Guess the amount of OnAsset we can buy/sell
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
  const poolOnUsd = toNumber(pool.onusdAmount);
  const poolOnAsset = toNumber(pool.onassetAmount);
  const L = lpTokens / lpSupply;
  if (isWithdraw) {
    const claimableOnUsd = L * poolOnUsd;
    const claimableOnAsset = L * poolOnAsset;
    resultPool.onusdAmount = convertToDecimal(
      poolOnUsd - claimableOnUsd,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      poolOnAsset - claimableOnAsset,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.liquidityTokenSupply = convertToDecimal(
      lpSupply - lpTokens,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
  } else {
    const addedOnUsd = L * poolOnUsd;
    const addedOnAsset = L * poolOnAsset;
    resultPool.onusdAmount = convertToDecimal(
      poolOnUsd + addedOnUsd,
      DEVNET_TOKEN_SCALE
    ).toRawDecimal();
    resultPool.onassetAmount = convertToDecimal(
      poolOnAsset + addedOnAsset,
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
  treasuryOnUsdTokenAccount: PublicKey,
  treasuryOnAssetTokenAccount: PublicKey
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
  const claimableOnUsd = floorToDevnetScale(L * toNumber(pool.onusdAmount));
  const claimableOnAsset = floorToDevnetScale(L * toNumber(pool.onassetAmount));
  const surplusOnUsd =
    claimableOnUsd - floorToDevnetScale(toNumber(cometPosition.borrowedOnusd));
  const surplusOnAsset =
    claimableOnAsset -
    floorToDevnetScale(toNumber(cometPosition.borrowedOnasset));
  const currentPoolPrice =
    toNumber(pool.onusdAmount) / toNumber(pool.onassetAmount);

  let recenterPool = resultantPool(
    pool,
    toNumber(cometPosition.liquidityTokenValue),
    true
  );
  // TODO: Optimize by splitting across exchanges with Jupiter.
  const absOnAssetAmount = Math.abs(surplusOnAsset);
  let onusdCost = -surplusOnUsd; // Only need to add/sub based on onasset trading.

  if (surplusOnAsset > 0) {
    // Want to sell surplus.
    ixs.push(
      clone.sellOnAssetInstruction(
        onusdTokenAccountInfo,
        onassetTokenAccountInfo,
        toDevnetScale(absOnAssetAmount),
        poolIndex,
        toDevnetScale((currentPoolPrice * Math.abs(surplusOnAsset)) / 1.5),
        treasuryOnUsdTokenAccount
      )
    );
    let { output, resultPool } = calculateOutputFromInput(
      recenterPool,
      surplusOnAsset,
      false
    );
    onusdCost -= output;
    recenterPool = deepCopy(resultPool);
  } else if (surplusOnAsset < 0) {
    // Want to buy deficit.
    ixs.push(
      clone.buyOnAssetInstruction(
        onusdTokenAccountInfo,
        onassetTokenAccountInfo,
        toDevnetScale(absOnAssetAmount),
        poolIndex,
        toDevnetScale(currentPoolPrice * Math.abs(surplusOnAsset) * 1.5),
        treasuryOnAssetTokenAccount
      )
    );
    let { input, resultPool } = calculateInputFromOutput(
      recenterPool,
      absOnAssetAmount,
      false
    );
    onusdCost += input;
    recenterPool = deepCopy(resultPool);
    // Pay OnAsset ILD
    ixs.push(
      clone.payCometILDInstruction(
        positionIndex,
        toDevnetScale(absOnAssetAmount),
        false,
        onassetTokenAccountInfo,
        onusdTokenAccountInfo,
        isSinglePool
      )
    );
  }
  // Pay onUSD ILD
  if (surplusOnUsd < 0) {
    ixs.push(
      clone.payCometILDInstruction(
        positionIndex,
        toDevnetScale(Math.abs(surplusOnUsd)),
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
    ? calculateNewSinglePoolCometFromOnUsdBorrowed(
        poolIndex,
        cometCollateral,
        onusdToDeploy,
        tokenData
      )
    : getHealthScore(tokenData, resultantComet);

  onusdCost = Math.max(onusdCost, 0);

  return { ...newPositionInfo, ixs, onusdCost };
};
