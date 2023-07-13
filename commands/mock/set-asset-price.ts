import { setPrice } from "../../sdk/src/oracle";
import {
  successLog,
  errorLog,
  anchorSetup,
  getPythProgram,
  getMockAssetPriceFeed,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  index: number;
  price: number;
}

exports.command = "set-asset-price <index> <price>";
exports.desc = "Sets the price of a mock asset using the Pyth program";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .positional("index", {
      describe: "The index of the asset in the Mock Jupiter Program",
      type: "number",
    })
    .positional("price", {
      describe: "The new mock asset price",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const pythProgram = getPythProgram(setup.provider);

    const priceFeed = await getMockAssetPriceFeed(
      setup.network,
      setup.provider,
      yargs.index
    );

    await setPrice(pythProgram, yargs.price, priceFeed);

    successLog(`Mock Asset ${yargs.index} price set to $${yargs.price}`);
  } catch (error: any) {
    errorLog(`Failed to Change Mock Asset Price:\n${error.message}`);
  }
};
