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

exports.command = "withdraw-collateral <borrow-index> <amount>";
exports.desc = "Withdraws collateral from your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("borrow-index", {
      describe: "The index of the borrow position",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral to withdraw from the borrow position",
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

    const oracles = await cloneClient.getOracles();
    const collateral = cloneClient.clone.collateral;

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );

    let upgradePricesIx = cloneClient.updatePricesInstruction(oracles);

    const amount = new BN(`${toScale(yargs.amount, Number(collateral.scale))}`);

    let ix = cloneClient.withdrawCollateralFromBorrowInstruction(
      yargs.borrowIndex,
      collateralTokenAccountInfo.address,
      amount
    );
    await provider.sendAndConfirm(
      new Transaction().add(upgradePricesIx).add(ix)
    );

    successLog(`${yargs.amount} Collateral Withdraw!`);
  } catch (error: any) {
    errorLog(
      `Failed to withdraw collateral from borrow position:\n${error.message}`
    );
  }
};
