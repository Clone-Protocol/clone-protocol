import { PublicKey } from "@solana/web3.js";
import { CloneClient } from "../../sdk/src/clone";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  collateralPubkey: string;
  scale: number;
  stable: boolean;
  collateralizationRatio: number;
  poolIndex: number;
}

exports.command = "add-collateral";

exports.desc = "Adds a new collateral type to Clone";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("collateral-pubkey", {
      describe: "Public key of the collateral",
      type: "string",
    })
    .option("scale", {
      describe: "The scale factor for the collateral token",
      type: "number",
    })
    .option("stable", {
      describe: "Is the collateral stable?",
      type: "boolean",
      default: true,
    })
    .option("collateralization-ratio", {
      describe: "The collateralization ratio",
      type: "number",
      default: 200,
    })
    .option("pool-index", {
      describe: "The pool index, unnecessary for non-stable",
      type: "number",
      default: 255,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    let cloneClient = new CloneClient(cloneProgram.programId, setup.provider);

    const collateralPubkey = new PublicKey(yargs.collateralPubkey);

    await cloneClient.addCollateral(
      cloneProgram.provider.publicKey!,
      yargs.scale,
      yargs.stable,
      collateralPubkey,
      yargs.collateralizationRatio,
      yargs.poolIndex
    );

    successLog("Collateral Added!");
  } catch (error: any) {
    errorLog(`Failed to add collateral:\n${error.message}`);
  }
};
