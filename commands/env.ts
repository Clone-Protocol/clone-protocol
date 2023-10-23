import { Argv } from 'yargs';

const network = require('./env/network');
const wallet = require('./env/wallet');
const setProgramIds = require('./env/set-program-ids');
const setCollateral = require('./env/set-collateral');

module.exports = (yargs: Argv) => {
  yargs
    .command(network)
    .command(wallet)
    .command(setProgramIds)
    .command(setCollateral)
    .demandCommand()
    .help();
}
