import { CLONE_TOKEN_SCALE } from "./clone";
//import { Pool } from "./interfaces";
import { Pool } from "../generated/clone";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
  Account,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import { Provider } from "@coral-xyz/anchor";

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

export const floortoCloneScale = (x: number) => {
  return floorToScale(x, CLONE_TOKEN_SCALE);
};

export const calculateMantissa = (
  x: number,
  scale: number = CLONE_TOKEN_SCALE
) => {
  return Math.floor(x * Math.pow(10, scale));
};

export const getPoolLiquidity = (pool: Pool, oraclePrice: number) => {
  const poolOnusd =
    Number(pool.committedOnusdLiquidity) - Number(pool.onusdIld);
  const poolOnasset =
    Number(pool.committedOnusdLiquidity) / oraclePrice -
    Number(pool.onassetIld);
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
  const output = floortoCloneScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floortoCloneScale(
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
  const treasuryFee = floortoCloneScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floortoCloneScale(
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
  const poolOnusd = floortoCloneScale(
    poolCommittedOnusdLiquidity - poolOnusdILD
  );
  const poolOnasset = floortoCloneScale(
    poolCommittedOnusdLiquidity / oraclePrice - poolOnassetILD
  );
  return { poolOnusd, poolOnasset };
};

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
    poolOnusdILD,
    poolOnassetILD,
    poolCommittedOnusdLiquidity,
    oraclePrice
  );
  const invariant = poolOnusd * poolOnasset;

  if (quantityIsInput) {
    const [inputSide, outputSide] = quantityIsOnusd
      ? [poolOnusd, poolOnasset]
      : [poolOnasset, poolOnusd];
    const outputBeforeFees = floortoCloneScale(
      outputSide - invariant / (inputSide + quantity)
    );
    const liquidityFeesPaid = floortoCloneScale(
      outputBeforeFees * liquidityTradingFees
    );
    const treasuryFeesPaid = floortoCloneScale(
      outputBeforeFees * treasuryTradingFees
    );
    const result = floortoCloneScale(
      outputBeforeFees - liquidityFeesPaid - treasuryFeesPaid
    );
    return {
      result,
      liquidityFeesPaid,
      treasuryFeesPaid,
    };
  } else {
    const [outputSide, inputSide] = quantityIsOnusd
      ? [poolOnusd, poolOnasset]
      : [poolOnasset, poolOnusd];
    const outputBeforeFees = floortoCloneScale(
      quantity / (1 - liquidityTradingFees - treasuryTradingFees)
    );
    const result = floortoCloneScale(
      invariant / (outputSide - outputBeforeFees) - inputSide
    );
    const liquidityFeesPaid = floortoCloneScale(
      outputBeforeFees * liquidityTradingFees
    );
    const treasuryFeesPaid = floortoCloneScale(
      outputBeforeFees * treasuryTradingFees
    );
    return {
      result,
      liquidityFeesPaid,
      treasuryFeesPaid,
    };
  }
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
    expectedOnusdAmount: floortoCloneScale(expectedOnusdAmount),
    onusdThresholdAmount: floortoCloneScale(onusdThresholdAmount),
    expectedPrice: floortoCloneScale(expectedOnusdAmount / onassetAmount),
    thresholdPrice: floortoCloneScale(onusdThresholdAmount / onassetAmount),
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

export const getOrCreateAssociatedTokenAccount = async (
  provider: Provider,
  mint: PublicKey,
  owner?: PublicKey,
  ownerOffCurve?: boolean
): Promise<Account> => {
  const associatedToken = await getAssociatedTokenAddress(
    mint,
    owner !== undefined ? owner : provider.publicKey!,
    ownerOffCurve !== undefined ? ownerOffCurve : false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  let account: Account;
  try {
    account = await getAccount(
      provider.connection,
      associatedToken,
      "recent",
      TOKEN_PROGRAM_ID
    );
  } catch (error: unknown) {
    if (error instanceof TokenAccountNotFoundError) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey!,
          associatedToken,
          owner ? owner : provider.publicKey!,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      await provider.sendAndConfirm!(transaction);
      account = await getAccount(
        provider.connection,
        associatedToken,
        "recent",
        TOKEN_PROGRAM_ID
      );
    } else {
      throw error;
    }
  }

  if (!account) {
    throw Error("Could not create account!");
  }
  return account;
};
