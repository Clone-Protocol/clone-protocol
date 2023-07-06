import { Transaction } from "@solana/web3.js";
import { CloneClient, toDevnetScale } from "../../sdk/src/clone";
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
  fromDevnetScale,
  anchorSetup,
  getCloneProgram,
  getOrCreateAssociatedTokenAccount,
} from "../utils";
import { Argv } from "yargs";
import { toNumber } from "../../sdk/src/decimal";

interface CommandArguments extends Argv {
  poolIndex: number;
  amount: number;
  quantityIsInput: boolean;
  quantityIsOnusd: boolean;
  slippage: number;
}

exports.command =
  "swap <pool-index> <amount> [quantity-is-input] [quantity-is-onusd] [slippage]";
exports.desc = "Buys onAsset from a Clone pool";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("pool-index", {
      describe: "The index of the onAsset pool you would like to trade with",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of onAsset to buy",
      type: "number",
    })
    .positional("quantity-is-input", {
      describe: "true if the amount is for the asset being sold",
      type: "boolean",
      default: false,
    })
    .positional("quantity-is-onusd", {
      describe: "true if the amount is for the onUSD",
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
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[yargs.poolIndex];

    let executionEst = calculateSwapExecution(
      yargs.amount,
      yargs.quantityIsInput,
      yargs.quantityIsOnusd,
      toNumber(pool.onusdIld),
      toNumber(pool.onassetIld),
      toNumber(pool.committedOnusdLiquidity),
      toNumber(pool.liquidityTradingFee),
      toNumber(pool.treasuryTradingFee),
      toNumber(pool.assetInfo.price)
    );

    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      cloneClient.clone!.onusdMint
    );
    const initialOnusdBalance = Number(onusdTokenAccountInfo.amount);
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
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

    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      cloneClient.clone!.treasuryAddress,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const treasuryOnusdTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnusdAssociatedTokenAddress,
      "recent"
    );

    const updatePricesIx = await cloneClient.updatePricesInstruction();

    const amount = new BN(`${toDevnetScale(yargs.amount)}`);
    const difference = (yargs.quantityIsInput ? -1 : 1) * yargs.slippage;

    let ix = await cloneClient.swapInstruction(
      yargs.poolIndex,
      amount,
      yargs.quantityIsInput,
      yargs.quantityIsOnusd,
      toDevnetScale(executionEst.result * (1 + difference)),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await setup.provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );


    
    if (yargs.quantityIsInput && yargs.quantityIsOnusd) {
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        setup.provider,
        pool.assetInfo.onassetMint
      );
      const newOnassetBalance = Number(onassetTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onUSD Sold!\nBought ${fromDevnetScale(
          newOnassetBalance - initialOnassetBalance
        )} onAsset ${yargs.poolIndex}`
      );
    } else if (yargs.quantityIsInput && !yargs.quantityIsOnusd) {
      onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        setup.provider,
        cloneClient.clone!.onusdMint
      );
      const newOnusdBalance = Number(onusdTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onAsset ${
          yargs.poolIndex
        } Sold!\nBought ${fromDevnetScale(
          newOnusdBalance - initialOnusdBalance
        )} onUSD`
      );
    } else if (!yargs.quantityIsInput && yargs.quantityIsOnusd) {
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        setup.provider,
        pool.assetInfo.onassetMint
      );
      const newOnassetBalance = Number(onassetTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onUSD Bought!\nSold ${fromDevnetScale(
          initialOnassetBalance - newOnassetBalance
        )} onAsset ${yargs.poolIndex}`
      );
    } else if (!yargs.quantityIsInput && !yargs.quantityIsOnusd) {
      onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        setup.provider,
        cloneClient.clone!.onusdMint
      );
      const newOnusdBalance = Number(onusdTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onAsset ${
          yargs.poolIndex
        } Bought!\nSold ${fromDevnetScale(
          initialOnusdBalance - newOnusdBalance
        )} onUSD`
      );
    }
  } catch (error: any) {
    errorLog(`Failed to swap:\n${error.message}`);
  }
};
