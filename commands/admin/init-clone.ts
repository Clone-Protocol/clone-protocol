import * as anchor from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCollateral,
  getCloneClient,
} from "../utils";
import { Argv } from "yargs";
import { CloneClient } from "../../sdk/src/clone";

interface CommandArguments extends Argv {
  cometCollateralLiquidatorFee: number;
  cometOnassetLiquidatorFee: number;
  borrowLiquidatorFee: number;
  collateralOracleIndex: number;
  collateralizationRatio: number;
}

exports.command = "init-clone";
exports.desc = "Initializes the Clone program with optional parameters";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("comet-collateral-liquidator-fee", {
      describe:
        "The fee percentage a liquidator recieves for liquidating collateral from comet positions",
      type: "number",
      default: 500,
    })
    .option("comet-onasset-liquidator-fee", {
      describe:
        "The fee percentage a liquidator recieves for liquidating onasset from comet positions",
      type: "number",
      default: 500,
    })
    .option("borrow-liquidator-fee", {
      describe: "The fee percentage a liquidator recieves for borrow positions",
      type: "number",
      default: 500,
    })
    .option("collateral-oracle-index", {
      describe: "The oracle index of the protocol's collateral",
      type: "number",
      default: 0,
    })
    .option("collateralization-ratio", {
      describe:
        "The percentage of the collateral value taken into account for liquidity positions",
      type: "number",
      default: 95,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [cloneProgramID, __] = getCloneData();
    const collateral = getCollateral();

    const treasuryAddress = anchor.web3.Keypair.generate();

    await CloneClient.initializeClone(
      provider,
      cloneProgramID,
      yargs.cometCollateralLiquidatorFee,
      yargs.cometOnassetLiquidatorFee,
      yargs.borrowLiquidatorFee,
      treasuryAddress.publicKey,
      collateral,
      yargs.collateralOracleIndex,
      yargs.collateralizationRatio
    );

    successLog("Clone Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Clone Program:\n${error.message}`);
  }
};
