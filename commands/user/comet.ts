import { Argv } from 'yargs';

const addCollateral = require('./view/add-collateral');
const withdrawCollateral = require('./view/withdraw-collateral');
const addLiquidity = require('./view/add-liquidity');
const withdrawLiquidity = require('./view/withdraw-liquidity');

module.exports = (yargs: Argv) => {
  yargs
    .command(addCollateral)
    .command(withdrawCollateral)
    .command(addLiquidity)
    .command(withdrawLiquidity)
    .demandCommand()
    .help();
}
