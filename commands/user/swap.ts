import { Transaction } from "@solana/web3.js";
import { CloneClient, toCloneScale } from "../../sdk/src/clone";
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
  quantityIsOnusd: boolean;
  slippage: number;
}

exports.command =
  "swap <pool-index> <amount> [quantity-is-input] [quantity-is-onusd] [slippage]";
exports.desc = "Swaps onAsset/onUSD from a Clone pool";
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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[yargs.poolIndex];
    const oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

    let executionEst = calculateSwapExecution(
      yargs.amount,
      yargs.quantityIsInput,
      yargs.quantityIsOnusd,
      Number(pool.onusdIld),
      Number(pool.onassetIld),
      Number(pool.committedOnusdLiquidity),
      Number(pool.liquidityTradingFee),
      Number(pool.treasuryTradingFee),
      Number(oracle.price)
    );

    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      cloneClient.clone!.onusdMint
    );
    const initialOnusdBalance = Number(onusdTokenAccountInfo.amount);
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

    const updatePricesIx = cloneClient.updatePricesInstruction(tokenData);

    const amount = new BN(`${toCloneScale(yargs.amount)}`);
    const difference = (yargs.quantityIsInput ? -1 : 1) * yargs.slippage;

    let ix = cloneClient.swapInstruction(
      yargs.poolIndex,
      amount,
      yargs.quantityIsInput,
      yargs.quantityIsOnusd,
      toCloneScale(executionEst.result * (1 + difference)),
      pool.assetInfo.onassetMint,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    if (yargs.quantityIsInput && yargs.quantityIsOnusd) {
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.onassetMint
      );
      const newOnassetBalance = Number(onassetTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onUSD Sold!\nBought ${fromCloneScale(
          newOnassetBalance - initialOnassetBalance
        )} onAsset ${yargs.poolIndex}`
      );
    } else if (yargs.quantityIsInput && !yargs.quantityIsOnusd) {
      onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        cloneClient.clone!.onusdMint
      );
      const newOnusdBalance = Number(onusdTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onAsset ${
          yargs.poolIndex
        } Sold!\nBought ${fromCloneScale(
          newOnusdBalance - initialOnusdBalance
        )} onUSD`
      );
    } else if (!yargs.quantityIsInput && yargs.quantityIsOnusd) {
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.onassetMint
      );
      const newOnassetBalance = Number(onassetTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onUSD Bought!\nSold ${fromCloneScale(
          initialOnassetBalance - newOnassetBalance
        )} onAsset ${yargs.poolIndex}`
      );
    } else if (!yargs.quantityIsInput && !yargs.quantityIsOnusd) {
      onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        cloneClient.clone!.onusdMint
      );
      const newOnusdBalance = Number(onusdTokenAccountInfo.amount);

      successLog(
        `${yargs.amount} onAsset ${
          yargs.poolIndex
        } Bought!\nSold ${fromCloneScale(
          initialOnusdBalance - newOnusdBalance
        )} onUSD`
      );
    }
  } catch (error: any) {
    errorLog(`Failed to swap:\n${error.message}`);
  }
};
