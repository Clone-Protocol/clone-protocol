import { Transaction } from "@solana/web3.js";
import { CloneClient, fromScale, toCloneScale } from "../../sdk/src/clone";
import { calculateSwapExecution } from "../../sdk/src/utils";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  fromCloneScale,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getOrCreateAssociatedTokenAccount,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  poolIndex: number;
  amount: number;
  quantityIsInput: boolean;
  quantityIsCollateral: boolean;
  slippage: number;
}

exports.command =
  "swap <pool-index> <amount> [quantity-is-input] [quantity-is-collateral] [slippage]";
exports.desc = "Swaps onAsset/collateral from a Clone pool";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("pool-index", {
      describe: "The index of the onAsset pool you would like to trade with",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount you would like to buy/sell",
      type: "number",
    })
    .positional("quantity-is-input", {
      describe: "true if the amount is for the asset being sold",
      type: "boolean",
      default: false,
    })
    .positional("quantity-is-collateral", {
      describe: "true if the amount is for the collateral",
      type: "boolean",
      default: false,
    })
    .positional("slippage", {
      describe: "The slippage tolerance on the trade",
      type: "number",
      default: 1,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const pools = await cloneClient.getPools();
    const oracles = await cloneClient.getOracles();
    const collateral = cloneClient.clone.collateral;

    const pool = pools.pools[yargs.poolIndex];
    const oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    let executionEst = calculateSwapExecution(
      yargs.amount,
      yargs.quantityIsInput,
      yargs.quantityIsCollateral,
      Number(pool.collateralIld),
      Number(pool.onassetIld),
      Number(pool.committedCollateralLiquidity),
      Number(pool.liquidityTradingFeeBps),
      Number(pool.treasuryTradingFeeBps),
      Number(oracle.price),
      collateral
    );

    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );
    const initialCollateralBalance = Number(collateralTokenAccountInfo.amount);
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      pool.assetInfo.onassetMint
    );
    const initialOnassetBalance = Number(onassetTokenAccountInfo.amount);

    const treasuryOnassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        cloneClient.clone!.treasuryAddress,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryOnassetTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnassetAssociatedTokenAddress,
      "recent"
    );

    const treasuryCollateralAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        collateral.mint,
        cloneClient.clone!.treasuryAddress,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryCollateralTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryCollateralAssociatedTokenAddress,
      "recent"
    );

    const updatePricesIx = cloneClient.updatePricesInstruction(oracles);

    const amount = new BN(`${toCloneScale(yargs.amount)}`);
    const difference = (yargs.quantityIsInput ? -1 : 1) * yargs.slippage;

    let ix = cloneClient.swapInstruction(
      yargs.poolIndex,
      amount,
      yargs.quantityIsInput,
      yargs.quantityIsCollateral,
      toCloneScale(executionEst.result * (1 + difference)),
      pool.assetInfo.onassetMint,
      collateralTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryCollateralTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    if (yargs.quantityIsInput && yargs.quantityIsCollateral) {
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.onassetMint
      );
      const newOnassetBalance = Number(onassetTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} collateral Sold!\nBought ${fromCloneScale(
          newOnassetBalance - initialOnassetBalance
        )} onAsset ${yargs.poolIndex}`
      );
    } else if (yargs.quantityIsInput && !yargs.quantityIsCollateral) {
      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        collateral.mint
      );
      const newCollateralBalance = Number(collateralTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onAsset ${yargs.poolIndex} Sold!\nBought ${fromScale(
          newCollateralBalance - initialCollateralBalance,
          cloneClient.clone.collateral.scale
        )} collateral tokens`
      );
    } else if (!yargs.quantityIsInput && yargs.quantityIsCollateral) {
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.onassetMint
      );
      const newOnassetBalance = Number(onassetTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} collateral Bought!\nSold ${fromCloneScale(
          initialOnassetBalance - newOnassetBalance
        )} onAsset ${yargs.poolIndex}`
      );
    } else if (!yargs.quantityIsInput && !yargs.quantityIsCollateral) {
      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        collateral.mint
      );
      const newCollateralBalance = Number(collateralTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onAsset ${yargs.poolIndex} Bought!\nSold ${fromScale(
          initialCollateralBalance - newCollateralBalance,
          cloneClient.clone.collateral.scale
        )} collateral tokens`
      );
    }
  } catch (error: any) {
    errorLog(`Failed to swap:\n${error.message}`);
  }
};
