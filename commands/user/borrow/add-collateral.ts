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

interface CommandArguments extends Argv {
  borrowIndex: number;
  amount: number;
}

exports.command = "add-collateral <borrow-index> <amount>";
exports.desc = "Adds collateral to your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("borrow-index", {
      describe: "The index of the borrow position",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral to add to the borrow position",
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
    const borrowPosition = user.borrows.positions[yargs.borrowIndex];

    const collateral =
      tokenData.collaterals[Number(borrowPosition.collateralIndex)];

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );

    const amount = new BN(`${toScale(yargs.amount, Number(collateral.scale))}`);

    let ix = cloneClient.addCollateralToBorrowInstruction(
      tokenData,
      user,
      yargs.borrowIndex,
      collateralTokenAccountInfo.address,
      amount
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} Collateral Added!`);
  } catch (error: any) {
    errorLog(`Failed to add collateral to borrow position:\n${error.message}`);
  }
};
