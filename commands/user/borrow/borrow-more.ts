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

exports.command = "borrow-more <borrow-index> <amount>";
exports.desc = "Adds onAsset debt to your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("borrow-index", {
      describe: "The index of the borrow position",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of additional onAsset to borrow",
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

    // @ts-ignore
    let signers: Array<Signer> = [setup.provider.wallet.payer];

    await cloneClient.borrowMore(
      onAssetTokenAccountInfo.address,
      amount,
      yargs.borrowIndex,
      signers
    );

    successLog(`${yargs.amount} onAsset Borrowed!`);
  } catch (error: any) {
    errorLog(`Failed to borrow additional onAsset:\n${error.message}`);
  }
};
