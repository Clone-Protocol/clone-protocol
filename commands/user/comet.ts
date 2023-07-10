import { Argv } from 'yargs';

const addCollateral = require('./comet/add-collateral');
const withdrawCollateral = require('./comet/withdraw-collateral');
const addLiquidity = require('./comet/add-liquidity');
const withdrawLiquidity = require('./comet/withdraw-liquidity');
const payIld = require('./comet/pay-ild');
const claimReward = require('./comet/claim-reward');

module.exports = (yargs: Argv) => {
  yargs
    .command(addCollateral)
    .command(withdrawCollateral)
    .command(addLiquidity)
    .command(withdrawLiquidity)
    .command(payIld)
    .command(claimReward)
    .demandCommand()
    .help();
}
