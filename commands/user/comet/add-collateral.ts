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

exports.command = "add-collateral <collateral-index> <amount>";
exports.desc = "Adds collateral to your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("collateral-index", {
      describe: "The index of the collateral you are providing",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral to add to the comet position",
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

    const collateral = tokenData.collaterals[yargs.collateralIndex];

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );

    const amount = new BN(`${toScale(yargs.amount, Number(collateral.scale))}`);

    let ix = cloneClient.addCollateralToCometInstruction(
      tokenData,
      collateralTokenAccountInfo.address,
      amount,
      yargs.collateralIndex
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} Collateral Added!`);
  } catch (error: any) {
    errorLog(`Failed to add collateral to comet position:\n${error.message}`);
  }
};
