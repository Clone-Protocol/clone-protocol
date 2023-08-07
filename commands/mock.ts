import { Argv } from "yargs";

const addAsset = require("./mock/add-asset");
const setAssetPrice = require("./mock/set-asset-price");
const mintUSDC = require("./mock/mint-usdc");
const mintAsset = require("./mock/mint-asset");
const initMockCln = require("./mock/init-mock-cln");
const mintMockCln = require("./mock/mint-mock-cln");
const view = require("./mock/view");

module.exports = (yargs: Argv) => {
  yargs
    .command(addAsset)
    .command(setAssetPrice)
    .command(mintUSDC)
    .command(mintAsset)
    .command(initMockCln)
    .command(mintMockCln)
    .command(view)
    .demandCommand()
    .help();
};
