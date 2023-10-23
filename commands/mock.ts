import { Argv } from "yargs";

const createPriceFeed = require("./mock/create-price-feed");
const setAssetPrice = require("./mock/set-asset-price");
const initCollateral = require("./mock/init-collateral");
const mintCollateral = require("./mock/mint-collateral");
const initCln = require("./mock/init-cln");
const mintCln = require("./mock/mint-cln");
const view = require("./mock/view");

module.exports = (yargs: Argv) => {
  yargs
    .command(createPriceFeed)
    .command(setAssetPrice)
    .command(mintCollateral)
    .command(initCollateral)
    .command(initCln)
    .command(mintCln)
    .command(view)
    .demandCommand()
    .help();
};
