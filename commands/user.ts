import { Argv } from 'yargs';

const init = require('./user/init');
const swap = require('./user/swap');
const mintOnUSD = require('./user/mint-onusd');
const viewCommands = require('./user/view');
const borrowCommands = require('./user/borrow');

module.exports = (yargs: Argv) => {
  yargs
    .command(init)
    .command(mintOnUSD)
    .command(swap)
    .command('view <command>', 'commands for viewing data', viewCommands)
    .command('borrow <command>', 'commands for managing borrow positions', borrowCommands)
    .demandCommand()
    .help();
}
