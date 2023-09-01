import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  clone: string;
  staking: string;
  faucet: string;
  pyth: string;
}

exports.command = "set-program-ids";
exports.desc = "Sets the ProgramIDs";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("clone", {
      describe: "The clone program id",
      type: "string",
      default: "",
    })
    .option("staking", {
      describe: "The staking program id",
      type: "string",
      default: "",
    })
    .option("faucet", {
      describe: "The faucet program id",
      type: "string",
      default: "",
    })
    .option("pyth", {
      describe: "The pyth program id",
      type: "string",
      default: "",
    });
};
exports.handler = function (yargs: CommandArguments) {
  try {
    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    if (yargs.clone != "") {
      config.clone = yargs.clone;
    }
    if (yargs.staking != "") {
      config.staking = yargs.staking;
    }
    if (yargs.faucet != "") {
      config.faucet = yargs.faucet;
    }
    if (yargs.pyth != "") {
      config.pyth = yargs.pyth;
    }
    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`Program IDs set!`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set program ids: ${error.message}`);
    } else {
      errorLog(`Failed to set program ids: ${error}`);
    }
  }
};
