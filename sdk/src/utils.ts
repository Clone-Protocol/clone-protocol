import { toNumber } from "./decimal";
import { DEVNET_TOKEN_SCALE } from "./clone";
import { Pool } from "./interfaces";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
  VersionedTransaction,
} from "@solana/web3.js";

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

export const getPoolLiquidity = (pool: Pool) => {
  const poolOnusd =
    toNumber(pool.committedOnusdLiquidity) - toNumber(pool.onusdIld);
  const poolOnasset =
    toNumber(pool.committedOnusdLiquidity) / toNumber(pool.assetInfo.price) -
    toNumber(pool.onassetIld);
  return {
    poolOnusd,
    poolOnasset,
  };
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
      return [poolOnusd + input, poolOnasset - output - treasuryFee];
    } else {
      return [poolOnusd - output - treasuryFee, poolOnasset + input];
    }
  })();

  return { output, resultPoolOnusd, resultPoolOnasset };
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
      return [poolOnusd - outputBeforeFees - treasuryFee, poolOnasset + input];
    } else {
      return [poolOnusd + input, poolOnasset - outputBeforeFees - treasuryFee];
    }
  })();
  return { input, resultPoolOnusd, resultPoolOnasset };
};

export const calculatePoolAmounts = (
  poolOnusdILD: number,
  poolOnassetILD: number,
  poolCommittedOnusdLiquidity: number,
  oraclePrice: number
  ) => {
    const poolOnusd = floorToDevnetScale(poolCommittedOnusdLiquidity - poolOnusdILD)
    const poolOnasset = floorToDevnetScale(poolCommittedOnusdLiquidity / oraclePrice - poolOnassetILD)
    return { poolOnusd, poolOnasset }
  }

export const calculateSwapExecution = (
  quantity: number,
  quantityIsInput: boolean,
  quantityIsOnusd: boolean,
  poolOnusdILD: number,
  poolOnassetILD: number,
  poolCommittedOnusdLiquidity: number,
  liquidityTradingFees: number,
  treasuryTradingFees: number,
  oraclePrice: number
) => {
  const { poolOnusd, poolOnasset } = calculatePoolAmounts(
    poolOnusdILD, poolOnassetILD, poolCommittedOnusdLiquidity, oraclePrice
  )
  const invariant = poolOnusd * poolOnasset

  if (quantityIsInput) {
    const [inputSide, outputSide] = quantityIsOnusd ? [poolOnusd, poolOnasset] : [poolOnasset, poolOnusd];
    const outputBeforeFees = floorToDevnetScale(
      outputSide - invariant / (inputSide + quantity)
    )
    const liquidityFeesPaid = floorToDevnetScale(outputBeforeFees * liquidityTradingFees)
    const treasuryFeesPaid = floorToDevnetScale(outputBeforeFees * treasuryTradingFees)
    const result = floorToDevnetScale(outputBeforeFees - liquidityFeesPaid - treasuryFeesPaid)
    return {
      result, liquidityFeesPaid, treasuryFeesPaid
    }
  } else {
    const [outputSide, inputSide] = quantityIsOnusd ? [poolOnusd, poolOnasset] : [poolOnasset, poolOnusd];
    const outputBeforeFees = floorToDevnetScale(
      quantity / (1. - liquidityTradingFees - treasuryTradingFees)
    )
    const result = floorToDevnetScale(
      invariant / (outputSide - outputBeforeFees) - inputSide
    )
    const liquidityFeesPaid = floorToDevnetScale(outputBeforeFees * liquidityTradingFees)
    const treasuryFeesPaid = floorToDevnetScale(outputBeforeFees * treasuryTradingFees)
    return {
      result, liquidityFeesPaid, treasuryFeesPaid
    }
  }
}

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
  const { poolOnusd, poolOnasset } = getPoolLiquidity(pool);
  return calculateExecutionThresholdFromParams(
    onassetAmount,
    isBuy,
    poolOnusd,
    poolOnasset,
    toNumber(pool.treasuryTradingFee),
    toNumber(pool.liquidityTradingFee),
    slippage
  );
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
