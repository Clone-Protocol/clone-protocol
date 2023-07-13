import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  network: string;
}

exports.command = "network <network-url>";
exports.desc = "Sets the current network";
exports.builder = {
  network: {
    describe: "The RPC URL to switch to",
  },
};
exports.handler = function (argv: CommandArguments) {
  try {
    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
    config.network = argv.network;
    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`Network set to ${argv.network}`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set network: ${error.message}`);
    } else {
      errorLog(`Failed to set network: ${error}`);
    }
  }
};
