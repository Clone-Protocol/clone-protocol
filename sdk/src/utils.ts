import { BN, Provider } from "@project-serum/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { toNumber } from "./decimal";
import { Value, Pool, DEVNET_TOKEN_SCALE } from "./incept";
import {
  getAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

// export const signAndSend = async (
//   tx: Transaction,
//   signers: Array<Keypair>,
//   connection: Connection,
//   opts?: ConfirmOptions
// ) => {
//   tx.setSigners(...signers.map((s) => s.publicKey));
//   const blockhash = await connection.getLatestBlockhash(
//     opts?.commitment || Provider.defaultOptions().commitment
//   );
//   tx.recentBlockhash = blockhash.blockhash;
//   tx.partialSign(...signers);
//   const rawTx = tx.serialize();
//   return await sendAndConfirmRawTransaction(
//     connection,
//     rawTx,
//     opts || Provider.defaultOptions()
//   );
// };

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const mul = (value1: Value, value2: Value) => {
  return {
    val: value1.val
      .mul(value2.val)
      .div(new BN(Math.pow(10, value2.scale.toNumber()))),
    scale: value1.scale,
  } as Value;
};

export const div = (value1: Value, value2: Value) => {
  return value2.val.eqn(0)
    ? ({ val: new BN(0), scale: value1.scale } as Value)
    : ({
        val: value1.val
          .mul(new BN(Math.pow(10, value2.scale.toNumber())))
          .div(value2.val),
        scale: value1.scale,
      } as Value);
};

export const toScaledNumber = (value: Value) => {
  const val = value.val.toNumber();
  if (val === 0) {
    return 0;
  }
  return val / Math.pow(10, value.scale.toNumber());
};

export const toScaledPercent = (value: Value) => {
  const denominator = new BN(Math.pow(10, Number(value.scale) - 2));
  return denominator.toNumber() === 0
    ? 0
    : Number(value.val.div(new BN(Math.pow(10, Number(value.scale) - 2))));
};

export const floorToScale = (x: number, scale: number) => {
  const f = Math.pow(10, scale);
  return Math.floor(x * f) / f;
};

export const calculateOutputFromInput = (
  pool: Pool,
  input: number,
  isInputUsdi: boolean
) => {
  const feeAdjustment =
    1 - toNumber(pool.liquidityTradingFee) - toNumber(pool.treasuryTradingFee);

  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const invariant = poolIasset * poolUsdi;

  if (isInputUsdi) {
    return floorToScale(
      feeAdjustment * (poolIasset - invariant / (poolUsdi + input)),
      DEVNET_TOKEN_SCALE
    );
  } else {
    return floorToScale(
      feeAdjustment * (poolUsdi - invariant / (poolIasset + input)),
      DEVNET_TOKEN_SCALE
    );
  }
};

export const calculateInputFromOutput = (
  pool: Pool,
  output: number,
  isOutputUsdi: boolean
) => {
  const feeAdjustment =
    1 - toNumber(pool.liquidityTradingFee) - toNumber(pool.treasuryTradingFee);

  const poolUsdi = toNumber(pool.usdiAmount);
  const poolIasset = toNumber(pool.iassetAmount);
  const invariant = poolIasset * poolUsdi;

  if (isOutputUsdi) {
    return floorToScale(
      invariant / (poolUsdi - output / feeAdjustment) - poolIasset,
      DEVNET_TOKEN_SCALE
    );
  } else {
    return floorToScale(
      invariant / (poolIasset - output / feeAdjustment) - poolUsdi,
      DEVNET_TOKEN_SCALE
    );
  }
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
    expectedUsdiAmount = calculateInputFromOutput(pool, iassetAmount, false);
    usdiThresholdAmount = expectedUsdiAmount / (1 - slippage);
  } else {
    const expectedUsdiAmount = calculateOutputFromInput(
      pool,
      iassetAmount,
      false
    );
    usdiThresholdAmount = expectedUsdiAmount * (1 - slippage);
  }

  return {
    expectedUsdiAmount: floorToScale(expectedUsdiAmount, DEVNET_TOKEN_SCALE),
    usdiThresholdAmount: floorToScale(usdiThresholdAmount, DEVNET_TOKEN_SCALE),
    expectedPrice: floorToScale(
      expectedUsdiAmount / iassetAmount,
      DEVNET_TOKEN_SCALE
    ),
    thresholdPrice: floorToScale(
      usdiThresholdAmount / iassetAmount,
      DEVNET_TOKEN_SCALE
    ),
  };
};
