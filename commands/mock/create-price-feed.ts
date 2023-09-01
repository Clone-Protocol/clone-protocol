import { createPriceFeed } from "../../sdk/src/oracle";
import { successLog, errorLog, anchorSetup, getPythData } from "../utils";
import { PublicKey } from "@solana/web3.js";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  price: number;
  expo: number;
}

exports.command = "create-price-feed <price> [expo]";
exports.desc = "Create the price of an onAsset using the Pyth program";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .positional("price", {
      describe: "The starting price",
      type: "number",
    })
    .positional("expo", {
      describe: "The exponent for the oracle price feed",
      type: "number",
      default: 8,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [pythProgramId, __] = getPythData();

    const priceFeed = await createPriceFeed(
      provider,
      pythProgramId,
      yargs.price,
      -yargs.expo,
    );

    successLog(`Created Price Feed: ${priceFeed.toString()}`);
  } catch (error: any) {
    errorLog(`Failed to Create Price Feed:\n${error.message}`);
  }
};
