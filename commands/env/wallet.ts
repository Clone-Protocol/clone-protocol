import fs from "fs";
import { successLog, errorLog } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  walletPath: string;
}

exports.command = "wallet <wallet-path>";
exports.desc = "Sets the wallet using path to private key";
exports.builder = {
  walletPath: {
    describe: "Path to the file containing the private key of the wallet",
    type: "string",
  },
};
exports.handler = function (argv: CommandArguments) {
  try {
    // Read the file and check if it's valid JSON
    const walletFile = fs.readFileSync(argv.walletPath, "utf8");
    JSON.parse(walletFile);

    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
    config.wallet = argv.walletPath;
    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog(`Wallet set to ${argv.walletPath}`);
  } catch (error: any) {
    if (error instanceof Error) {
      errorLog(`Failed to set network: ${error.message}`);
    } else {
      errorLog(`Failed to set network: ${error}`);
    }
  }
};
