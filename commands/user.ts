import { Argv } from 'yargs';

const initAccount = require('./user/init-account');
const mintOnUSD = require('./user/mint-onusd');
const viewCommands = require('./user/view');
const borrowCommands = require('./user/borrow');

module.exports = (yargs: Argv) => {
  yargs
    .command(initAccount)
    .command(mintOnUSD)
    .command('view <command>', 'commands for viewing data', viewCommands)
    .command('borrow <command>', 'commands for managing borrow positions', borrowCommands)
    .demandCommand()
    .help();
}
