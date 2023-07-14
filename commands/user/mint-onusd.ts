import { Transaction } from "@solana/web3.js";
import { CloneClient, toDevnetScale } from "../../sdk/src/clone";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getUSDC,
  getCloneProgram,
  getOrCreateAssociatedTokenAccount,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  amount: number;
}

exports.command = "mint-onusd <amount>";
exports.desc = "Mints onUSD into the user's account in exchange for USDC";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("amount", {
    describe: "The amount of onUSD to mint",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const usdcMint = await getUSDC();

    const usdcTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      usdcMint
    );
    const onUSDTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    const amount = new BN(`${toDevnetScale(yargs.amount)}`);
    let ix = await cloneClient.mintOnusdInstruction(
      amount,
      onUSDTokenAccountInfo.address,
      usdcTokenAccountInfo.address
    );
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} onUSD Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint onUSD:\n${error.message}`);
  }
};
