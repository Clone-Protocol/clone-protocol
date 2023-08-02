import { Transaction } from "@solana/web3.js";
import { toCloneScale } from "../../sdk/src/clone";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getUSDC,
  getCloneData,
  getCloneClient,
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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const tokenData = await cloneClient.getTokenData();
    const usdcMint = await getUSDC();

    const usdcTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      usdcMint
    );
    const onUSDTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    const amount = new BN(`${toCloneScale(yargs.amount)}`);
    let ix = cloneClient.mintOnusdInstruction(
      tokenData,
      amount,
      onUSDTokenAccountInfo.address,
      usdcTokenAccountInfo.address
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} onUSD Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint onUSD:\n${error.message}`);
  }
};
