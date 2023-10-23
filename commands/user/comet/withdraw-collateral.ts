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
  collateralIndex: number;
  amount: number;
}

exports.command = "withdraw-collateral <amount>";
exports.desc = "Withdraws collateral from your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs.positional("amount", {
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
    const collateral = cloneClient.clone.collateral;

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );


    const oracles = await cloneClient.getOracles();
    let updatePricesIx = await cloneClient.updatePricesInstruction(oracles);

    const amount = new BN(`${toScale(yargs.amount, Number(collateral.scale))}`);

    let ix = cloneClient.withdrawCollateralFromCometInstruction(
      collateralTokenAccountInfo.address,
      amount
    );

    await provider.sendAndConfirm(new Transaction().add(updatePricesIx).add(ix));

    successLog(`${yargs.amount} Collateral Withdrawn!`);
  } catch (error: any) {
    errorLog(
      `Failed to withdraw collateral from comet position:\n${error.message}`
    );
  }
};
