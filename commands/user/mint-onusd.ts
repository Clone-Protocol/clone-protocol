import * as anchor from "@coral-xyz/anchor";
import { CloneClient } from "../../sdk/src/clone";
import { Transaction } from "@solana/web3.js";
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
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const usdcMint = await getUSDC(setup.network, setup.provider);

    const usdcTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      usdcMint
    );
    const onUSDTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    await cloneClient.mintOnusd(
      yargs.amount,
      onUSDTokenAccountInfo.address,
      usdcTokenAccountInfo.address
    );

    successLog(`${yargs.amount} onUSD Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint onUSD:\n${error.message}`);
  }
};
