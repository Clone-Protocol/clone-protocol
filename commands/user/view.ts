import { Argv } from 'yargs';

const pools = require('./view/pools');
const collaterals = require('./view/collaterals');

module.exports = (yargs: Argv) => {
  yargs
    .command(pools)
    .command(collaterals)
    .demandCommand()
    .help();
}
