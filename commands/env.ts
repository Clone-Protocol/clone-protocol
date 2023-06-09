import { Argv } from 'yargs';

const network = require('./env/network');
const wallet = require('./env/wallet');

module.exports = (yargs: Argv) => {
  yargs
    .command(network)
    .command(wallet)
    .demandCommand()
    .help();
}
