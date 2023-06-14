import { Argv } from 'yargs';

const pools = require('./view/pools');
const collaterals = require('./view/collaterals');
const borrowPositions = require('./view/borrow-positions');

module.exports = (yargs: Argv) => {
  yargs
    .command(pools)
    .command(collaterals)
    .command(borrowPositions)
    .demandCommand()
    .help();
}
