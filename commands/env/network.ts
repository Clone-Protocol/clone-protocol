import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  networkUrl: string;
}

exports.command = "network <network-url>";
exports.desc = "Sets the current network";
exports.builder = (yargs: CommandArguments) => {
  return yargs.option("network-url", {
    describe: "The network to switch to",
    type: "string",
  });
};
exports.handler = function (yargs: CommandArguments) {
  try {
    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.network = yargs.networkUrl;

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`Network set to ${yargs.networkUrl}`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set network: ${error.message}`);
    } else {
      errorLog(`Failed to set network: ${error}`);
    }
  }
};
