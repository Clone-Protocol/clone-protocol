import { Transaction } from "@solana/web3.js";
import { toScale } from "../../../sdk/src/clone";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getOrCreateAssociatedTokenAccount,
} from "../../utils";
import { Argv } from "yargs";
import { User } from "../../../sdk/generated/clone";

interface CommandArguments extends Argv {
  collateralIndex: number;
  amount: number;
}

exports.command = "withdraw-collateral <collateral-index> <amount>";
exports.desc = "Withdraws collateral from your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("collateral-index", {
      describe: "The index of the collateral you are withdrawing",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral to withdraw from the comet position",
      type: "number",
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
    const user = await cloneClient.getUserAccount();
    const collateral = tokenData.collaterals[yargs.collateralIndex];

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );

    const amount = new BN(`${toScale(yargs.amount, Number(collateral.scale))}`);

    let ix = cloneClient.withdrawCollateralFromCometInstruction(
      tokenData,
      user,
      collateralTokenAccountInfo.address,
      amount,
      yargs.collateralIndex
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} Collateral Withdrawn!`);
  } catch (error: any) {
    errorLog(
      `Failed to withdraw collateral from comet position:\n${error.message}`
    );
  }
};
