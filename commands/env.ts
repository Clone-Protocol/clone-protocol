import { Argv } from 'yargs';

const network = require('./env/network');
const wallet = require('./env/wallet');
const setProgramIds = require('./env/set-program-ids');
const setUSDC = require('./env/set-usdc');

module.exports = (yargs: Argv) => {
  yargs
    .command(network)
    .command(wallet)
    .command(setProgramIds)
    .command(setUSDC)
    .demandCommand()
    .help();
}
