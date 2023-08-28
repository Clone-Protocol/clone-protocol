import { setPrice } from "../../sdk/src/oracle";
import {
  successLog,
  errorLog,
  anchorSetup,
} from "../utils";
import { PublicKey } from "@solana/web3.js";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  priceFeed: number;
  price: number;
}

exports.command = "set-asset-price <price-feed> <price>";
exports.desc = "Sets the price of a mock asset using the Pyth program";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .positional("price-feed", {
      describe: "The price feed of the asset",
      type: "string",
    })
    .positional("price", {
      describe: "The new mock asset price",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const priceFeed = new PublicKey(yargs.priceFeed);

    await setPrice(provider, yargs.price, priceFeed);

    successLog(`Mock asset price set to $${yargs.price}`);
  } catch (error: any) {
    errorLog(`Failed to Change Mock Asset Price:\n${error.message}`);
  }
};
