import { Argv } from "yargs";

const addAsset = require("./mock/add-asset");
const setAssetPrice = require("./mock/set-asset-price");
const mintMockUSDC = require("./mock/mint-mock-usdc");
const view = require("./mock/view");

module.exports = (yargs: Argv) => {
  yargs
    .command(addAsset)
    .command(setAssetPrice)
    .command(mintMockUSDC)
    .command(view)
    .demandCommand()
    .help();
};
