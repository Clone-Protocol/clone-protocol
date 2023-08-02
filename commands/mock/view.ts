import { getFeedData } from "../../sdk/src/oracle";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterData,
  getJupiterAccount,
} from "../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "view";
exports.desc =
  "View all mock assets using the Mock Jupiter and the Pyth program";
exports.builder = {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();
    const [__, jupiterAddress] = getMockJupiterData();

    const jupiter = await getJupiterAccount(provider, jupiterAddress);

    const assetBoxenOptions: boxen.Options = {
      padding: 1,
      margin: 1,
      // @ts-ignore
      borderStyle: "double",
      borderColor: "green",
      backgroundColor: "#CCCCCC",
    };

    let underline = new Array(`USDC`.length).fill("-").join("");
    let assetInfo =
      `USDC\n` + `${underline}\n` + `Mint: ${chalk.bold(jupiter.usdcMint)}\n`;

    console.log(boxen(assetInfo, assetBoxenOptions));

    for (let i = 0; i < jupiter.nAssets; i++) {
      const mint = jupiter.assetMints[i];
      const priceFeed = jupiter.oracles[i];
      const feedData = await getFeedData(provider, priceFeed);
      const price = feedData.aggregate.price;
      const exponent = feedData.exponent;

      const title = `Asset ${i + 1}`;
      underline = new Array(title.length).fill("-").join("");

      assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `Mint: ${chalk.bold(mint)}\n` +
        `Price Feed Address: ${chalk.bold(priceFeed)}\n` +
        `Price: ${chalk.bold(price)}\n` +
        `Exponent: ${chalk.bold(exponent)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${jupiter.nAssets} mock assets`);
  } catch (error: any) {
    errorLog(`Failed to view mock assets:\n${error.message}`);
  }
};
