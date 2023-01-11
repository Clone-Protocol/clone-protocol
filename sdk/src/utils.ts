import { BN, Provider } from "@project-serum/anchor";
import {
  Connection,
  Keypair,
  Transaction,
  ConfirmOptions,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import { toNumber } from "./decimal";
import { Value, Pool } from "./incept";

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

export const calculateOutputFromInput = (pool: Pool, input: number, isInputUsdi: boolean) => {
  const feeAdjustment = 1 - toNumber(pool.liquidityTradingFee) - toNumber(pool.treasuryTradingFee)

  const poolUsdi = toNumber(pool.usdiAmount)
  const poolIasset = toNumber(pool.iassetAmount)
  const invariant = poolIasset * poolUsdi

  if (isInputUsdi) {
    return feeAdjustment * (poolIasset - invariant / (poolUsdi + input));
  } else {
    return feeAdjustment * (poolUsdi - invariant / (poolIasset + input));
  }
}

export const calculateInputFromOutput = (pool: Pool, output: number, isOutputUsdi: boolean) => {
  const feeAdjustment = 1 - toNumber(pool.liquidityTradingFee) - toNumber(pool.treasuryTradingFee)

  const poolUsdi = toNumber(pool.usdiAmount)
  const poolIasset = toNumber(pool.iassetAmount)
  const invariant = poolIasset * poolUsdi

  if (isOutputUsdi) {
    return invariant / (poolUsdi - output / feeAdjustment) - poolIasset
  } else {
    return invariant / (poolIasset - output / feeAdjustment) - poolUsdi
  }
}
