import { Transaction } from "@solana/web3.js";
import { toCloneScale } from "../../../sdk/src/clone";
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

    const pool = tokenData.pools[Number(borrowPosition.poolIndex)];

    const onAssetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      pool.assetInfo.onassetMint
    );

    const amount = new BN(`${toCloneScale(yargs.amount)}`);

    let ix = cloneClient.payBorrowDebtInstruction(
      tokenData,
      user,
      onAssetTokenAccountInfo.address,
      amount,
      yargs.borrowIndex
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} onAsset Debt Payed!`);
  } catch (error: any) {
    errorLog(`Failed to pay onAsset debt:\n${error.message}`);
  }
};
