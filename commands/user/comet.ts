import { Argv } from 'yargs';

const addCollateral = require('./comet/add-collateral');
const withdrawCollateral = require('./comet/withdraw-collateral');
const addLiquidity = require('./comet/add-liquidity');
const withdrawLiquidity = require('./comet/withdraw-liquidity');

module.exports = (yargs: Argv) => {
  yargs
    .command(addCollateral)
    .command(withdrawCollateral)
    .command(addLiquidity)
    .command(withdrawLiquidity)
    .demandCommand()
    .help();
}
