import { CloneClient, toDevnetScale } from "../../sdk/src/clone";
import { calculateExecutionThreshold } from "../../sdk/src/utils";
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

interface CommandArguments extends Argv {
  poolIndex: number;
  amount: number;
  onusdIsInput: boolean;
  onusdIsDesignatedAmount: boolean;
  slippage: number;
}

exports.command = "swap <pool-index> <amount> <onusd-is-input> <onusd-is-designated-amount> [slippage]";
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
    .positional("onusd-is-input", {
      describe: "The amount of onAsset to buy",
      type: "boolean",
    })
    .positional("onusd-is-designated-amount", {
      describe: "The amount of onAsset to buy",
      type: "boolean",
    })
    .positional("slippage", {
      describe: "The slippage tolerance on the trade",
      type: "number",
      default: 0.0001,
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

    //This will change
    const executionEst = calculateExecutionThreshold(
      yargs.onassetAmount,
      true,
      pool,
      yargs.slippage
    );

    //need to check which of 4 potential swap types it is and handle each accordingly
    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      cloneClient.clone!.onusdMint
    );
    const initialOnusdBalance = Number(onusdTokenAccountInfo.amount);
    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      pool.assetInfo.onassetMint
    );

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

    const amount = new BN(`${toDevnetScale(yargs.onassetAmount)}`);

    await cloneClient.buyOnasset(
      amount,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      yargs.poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnassetTokenAccount.address
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      cloneClient.clone!.onusdMint
    );
    const newOnusdBalance = Number(onusdTokenAccountInfo.amount);

    successLog(
      `${yargs.onassetAmount} onAsset ${
        yargs.poolIndex
      } Bought!\nSpent ${fromDevnetScale(
        initialOnusdBalance - newOnusdBalance
      )} onUSD`
    );
  } catch (error: any) {
    errorLog(`Failed to buy:\n${error.message}`);
  }
};
