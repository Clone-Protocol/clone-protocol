import { PublicKey } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  collateralPubkey: string;
  scale: number;
  collateralizationRatio: number;
  oracleInfoIndex: number;
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
    .option("collateralization-ratio", {
      describe: "The collateralization ratio",
      type: "number",
      default: 100,
    })
    .option("oracle-info-index", {
      describe: "The oracle index, unnecessary for USDC",
      type: "number",
      default: 255,
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

    const collateralMint = new PublicKey(yargs.collateralPubkey);
    await cloneClient.addCollateral(
      collateralMint,
      yargs.oracleInfoIndex,
      yargs.collateralizationRatio
    );

    successLog("Collateral Added!");
  } catch (error: any) {
    errorLog(`Failed to add collateral:\n${error.message}`);
  }
};
