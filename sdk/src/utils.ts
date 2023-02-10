import { toNumber } from "./decimal";
import { DEVNET_TOKEN_SCALE } from "./incept";
import { Pool } from "./interfaces";
import { PublicKey } from "@solana/web3.js";

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    expectedUsdiAmount = calculateOutputFromInput(
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
