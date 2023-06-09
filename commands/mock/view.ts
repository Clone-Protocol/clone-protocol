//For viewing Mock Jupiter data
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getFeedData } from "../../sdk/src/oracle";
import {
  successLog,
  errorLog,
  anchorSetup,
  getJupiterProgram,
  getPythProgram,
  getMockAssetPriceFeed,
} from "../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "view";
exports.desc =
  "View all mock assets using the Mock Jupiter and the Pyth program";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();

    const jupiterProgram = getJupiterProgram(setup.network, setup.provider);
    const pythProgram = getPythProgram(setup.network, setup.provider);

    let [jupiterAddress, _] = await PublicKey.findProgramAddress(
      [anchor.utils.bytes.utf8.encode("jupiter")],
      jupiterProgram.programId
    );

    const jupiter = await jupiterProgram.account.jupiter.fetch(jupiterAddress);

    const assetBoxenOptions: boxen.Options = {
      padding: 1,
      margin: 1,
      // @ts-ignore
      borderStyle: "double",
      borderColor: "green",
      backgroundColor: "#CCCCCC",
    };

    const underline = new Array(`USDC Mint`.length).fill("-").join("");
    let assetInfo =
      `USDC\n` + `${underline}\n` + `Mint: ${chalk.bold(jupiter.usdcMint)}\n`;

    console.log(boxen(assetInfo, assetBoxenOptions));

    for (let i = 0; i < jupiter.nAssets; i++) {
      const priceFeed = await getMockAssetPriceFeed(
        setup.network,
        setup.provider,
        i
      );

      const mint = jupiter.assetMints[i];
      const priceFeedAddress = jupiter.oracles[i];
      const feedData = await getFeedData(pythProgram, priceFeed);
      const price = feedData.aggregate.price;
      const exponent = feedData.exponent;

      const title = `Asset ${i + 1}`;

      assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `Mint: ${chalk.bold(mint)}\n` +
        `Price Feed Address: ${chalk.bold(priceFeedAddress)}\n` +
        `Price: ${chalk.bold(price)}\n` +
        `Exponent: ${chalk.bold(exponent)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${jupiter.nAssets} mock assets`);
  } catch (error: any) {
    errorLog(`Failed to view mock assets:\n${error.message}`);
  }
};
