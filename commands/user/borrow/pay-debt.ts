import { Transaction } from "@solana/web3.js";
import { CloneClient, toDevnetScale } from "../../../sdk/src/clone";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getOrCreateAssociatedTokenAccount,
} from "../../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  borrowIndex: number;
  amount: number;
}

exports.command = "pay-debt <borrow-index> <amount>";
exports.desc = "Pays onAsset debt from your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("borrow-index", {
      describe: "The index of the borrow position",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of onAsset debt to pay off",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();
    const borrowPosition = (await cloneClient.getBorrowPositions())
      .borrowPositions[yargs.borrowIndex];

    const pool = tokenData.pools[borrowPosition.poolIndex];

    const onAssetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      pool.assetInfo.onassetMint
    );

    const amount = new BN(`${toDevnetScale(yargs.amount)}`);

    let ix = await cloneClient.payBorrowDebtInstruction(
      onAssetTokenAccountInfo.address,
      amount,
      yargs.borrowIndex,
    );
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} onAsset Debt Payed!`);
  } catch (error: any) {
    errorLog(`Failed to pay onAsset debt:\n${error.message}`);
  }
};
