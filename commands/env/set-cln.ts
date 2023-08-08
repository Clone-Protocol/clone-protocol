import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  cln: string;
}

exports.command = "set-cln <cln>";
exports.desc = "Sets $CLN mint";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("cln", {
    describe: "$CLN mint",
    type: "string",
  });
};
exports.handler = function (yargs: CommandArguments) {
  try {
    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.cln = yargs.cln;

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`$CLN set!`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set $CLN: ${error.message}`);
    } else {
      errorLog(`Failed to set $CLN: ${error}`);
    }
  }
};
