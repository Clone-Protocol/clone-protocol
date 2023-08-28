import { Transaction } from "@solana/web3.js";
import { createMintToCheckedInstruction } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCLN,
  getOrCreateAssociatedTokenAccount,
} from "../utils";
import { Argv } from "yargs";
import { CLONE_TOKEN_SCALE, toScale } from "../../sdk/src/clone";

interface CommandArguments extends Argv {
  amount: number;
}

exports.command = "mint-cln <amount>";
exports.desc = "Mint mock $CLN to user account";
exports.builder = (yargs: CommandArguments) => {
  return yargs.option("amount", {
    describe: "The amount of $CLN to mint",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();

    const clnTokenMint = getCLN();

    const clnTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      clnTokenMint
    );

    const amount = toScale(yargs.amount, CLONE_TOKEN_SCALE).toNumber();

    const ix = createMintToCheckedInstruction(
      clnTokenMint,
      clnTokenAccountInfo.address,
      provider.publicKey,
      amount,
      CLONE_TOKEN_SCALE
    );

    await provider.sendAndConfirm!(new Transaction().add(ix));

    successLog(`${yargs.amount} $CLN Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint $CLN:\n${error.message}`);
  }
};
