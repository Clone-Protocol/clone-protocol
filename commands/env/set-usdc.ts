import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  usdc: string;
}

exports.command = "set-usdc <usdc>";
exports.desc = "Sets the current network";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("usdc", {
    describe: "USDC mint",
    type: "string",
  });
};
exports.handler = function (yargs: CommandArguments) {
  try {
    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.usdc = yargs.usdc;

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`USDC set!`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set USDC: ${error.message}`);
    } else {
      errorLog(`Failed to set USDC: ${error}`);
    }
  }
};
