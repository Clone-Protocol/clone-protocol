import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  collateral: string;
}

exports.command = "set-collateral <collateral>";
exports.desc = "Sets USDC mint";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("collateral", {
    describe: "collateral mint",
    type: "string",
  });
};
exports.handler = function (yargs: CommandArguments) {
  try {
    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.collateral = yargs.collateral;

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`Collateral set!`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set Collateral: ${error.message}`);
    } else {
      errorLog(`Failed to set Collateral: ${error}`);
    }
  }
};
