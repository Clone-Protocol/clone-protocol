import fs from "fs";
import { successLog, errorLog, anchorSetup } from "../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "view";
exports.desc =
  "View all mock assets using the Mock Jupiter and the Pyth program";
exports.builder = {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();

    const assetBoxenOptions: boxen.Options = {
      padding: 1,
      margin: 1,
      // @ts-ignore
      borderStyle: "double",
      borderColor: "green",
      backgroundColor: "#CCCCCC",
    };

    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    if (config.cln != "") {
      let underline = new Array("$CLN".length).fill("-").join("");
      let assetInfo =
        `$CLN\n` + `${underline}\n` + `Mint: ${chalk.bold(config.cln)}\n`;

      console.log(boxen(assetInfo, assetBoxenOptions));
    }
    if (config.collateral != "") {
      let underline = new Array(`USDC`.length).fill("-").join("");
      let assetInfo =
        `USDC\n` +
        `${underline}\n` +
        `Mint: ${chalk.bold(config.collateral)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing mock assets`);
  } catch (error: any) {
    errorLog(`Failed to view mock assets:\n${error.message}`);
  }
};
