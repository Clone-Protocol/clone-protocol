import {
  CLONE_TOKEN_SCALE,
  fromScale,
  fromCloneScale,
  toCloneScale,
} from "./clone";
//import { Pool } from "./interfaces";
import { Collateral, Pool } from "../generated/clone";
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
  let sign = x < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(x) * Math.pow(10, scale)) * Math.pow(10, -scale);
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

export const getPoolLiquidity = (
  pool: Pool,
  oraclePrice: number,
  collateralScale: number,
  oracleScale: number
) => {
  const poolCollateral =
    Number(pool.committedCollateralLiquidity) - Number(pool.collateralIld);
  const poolOnasset = Number(
    toCloneScale(
      Number(fromScale(pool.committedCollateralLiquidity, collateralScale)) /
        Number(fromScale(oraclePrice, oracleScale)) -
        Number(fromCloneScale(Number(pool.onassetIld)))
    )
  );
  return {
    poolCollateral,
    poolOnasset,
  };
};

export const calculateOutputFromInputFromParams = (
  poolCollateral: number,
  poolOnasset: number,
  treasuryFeeRate: number,
  liquidityTradingFeeRate: number,
  input: number,
  isInputCollateral: boolean
) => {
  const totalFeeRate = liquidityTradingFeeRate + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;
  const invariant = poolOnasset * poolCollateral;

  const outputBeforeFees = isInputCollateral
    ? poolOnasset - invariant / (poolCollateral + input)
    : poolCollateral - invariant / (poolOnasset + input);
  const output = floortoCloneScale(feeAdjustment * outputBeforeFees);
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floortoCloneScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const [resultpoolCollateral, resultPoolOnasset] = (() => {
    if (isInputCollateral) {
      return [poolCollateral + input, poolOnasset - output - treasuryFee];
    } else {
      return [poolCollateral - output - treasuryFee, poolOnasset + input];
    }
  })();

  return { output, resultpoolCollateral, resultPoolOnasset };
};

export const calculateInputFromOutputFromParams = (
  poolCollateral: number,
  poolOnasset: number,
  treasuryFeeRate: number,
  liquidityTradingFeeRate: number,
  output: number,
  isOutputOnusd: boolean
) => {
  const totalFeeRate = liquidityTradingFeeRate + treasuryFeeRate;
  const feeAdjustment = 1 - totalFeeRate;
  const invariant = poolOnasset * poolCollateral;

  const outputBeforeFees = output / feeAdjustment;
  const totalFees = outputBeforeFees - output;
  const treasuryFee = floortoCloneScale(
    (totalFees * treasuryFeeRate) / totalFeeRate
  );
  const input = floortoCloneScale(
    isOutputOnusd
      ? invariant / (poolCollateral - outputBeforeFees) - poolOnasset
      : invariant / (poolOnasset - outputBeforeFees) - poolCollateral
  );
  const [resultpoolCollateral, resultPoolOnasset] = (() => {
    if (isOutputOnusd) {
      return [
        poolCollateral - outputBeforeFees - treasuryFee,
        poolOnasset + input,
      ];
    } else {
      return [
        poolCollateral + input,
        poolOnasset - outputBeforeFees - treasuryFee,
      ];
    }
  })();
  return { input, resultpoolCollateral, resultPoolOnasset };
};

export const calculatePoolAmounts = (
  poolCollateralILD: number,
  poolOnassetILD: number,
  poolCommittedCollateralLiquidity: number,
  oraclePrice: number,
  collateral: Collateral
) => {
  const poolCollateral = floorToScale(
    poolCommittedCollateralLiquidity - poolCollateralILD,
    collateral.scale
  );
  const poolOnasset = floortoCloneScale(
    poolCommittedCollateralLiquidity / oraclePrice - poolOnassetILD
  );
  return { poolCollateral, poolOnasset };
};

export const calculateSwapExecution = (
  quantity: number,
  quantityIsInput: boolean,
  quantityIsCollateral: boolean,
  poolCollateralILD: number,
  poolOnassetILD: number,
  poolCommittedCollateralLiquidity: number,
  liquidityTradingFees: number,
  treasuryTradingFees: number,
  oraclePrice: number,
  collateral: Collateral
) => {
  const { poolCollateral, poolOnasset } = calculatePoolAmounts(
    poolCollateralILD,
    poolOnassetILD,
    poolCommittedCollateralLiquidity,
    oraclePrice,
    collateral
  );
  const invariant = poolCollateral * poolOnasset;

  if (quantityIsInput) {
    const [inputSide, outputSide, outputScale] = quantityIsCollateral
      ? [poolCollateral, poolOnasset, CLONE_TOKEN_SCALE]
      : [poolOnasset, poolCollateral, collateral.scale];
    const outputBeforeFees = floorToScale(
      outputSide - invariant / (inputSide + quantity),
      outputScale
    );
    const liquidityFeesPaid = floorToScale(
      outputBeforeFees * liquidityTradingFees,
      outputScale
    );
    const treasuryFeesPaid = floorToScale(
      outputBeforeFees * treasuryTradingFees,
      outputScale
    );
    const result = floorToScale(
      outputBeforeFees - liquidityFeesPaid - treasuryFeesPaid,
      outputScale
    );
    return {
      result,
      liquidityFeesPaid,
      treasuryFeesPaid,
    };
  } else {
    const [outputSide, inputSide, inputScale, outputScale] =
      quantityIsCollateral
        ? [poolCollateral, poolOnasset, CLONE_TOKEN_SCALE, collateral.scale]
        : [poolOnasset, poolCollateral, collateral.scale, CLONE_TOKEN_SCALE];
    const outputBeforeFees = floorToScale(
      quantity / (1 - liquidityTradingFees - treasuryTradingFees),
      outputScale
    );
    const result = floorToScale(
      invariant / (outputSide - outputBeforeFees) - inputSide,
      inputScale
    );
    const liquidityFeesPaid = floorToScale(
      outputBeforeFees * liquidityTradingFees,
      outputScale
    );
    const treasuryFeesPaid = floorToScale(
      outputBeforeFees * treasuryTradingFees,
      outputScale
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
  poolCollateral: number,
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
      poolCollateral,
      poolOnasset,
      treasuryTradingFee,
      liquidityTradingFee,
      onassetAmount,
      false
    ).input;
    onusdThresholdAmount = expectedOnusdAmount / (1 - slippage);
  } else {
    expectedOnusdAmount = calculateOutputFromInputFromParams(
      poolCollateral,
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
