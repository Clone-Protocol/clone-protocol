import { Argv } from 'yargs';

const initAccount = require('./user/init-account');
const viewCommands = require('./user/view');

module.exports = (yargs: Argv) => {
  yargs
    .command(initAccount)
    .command('view <command>', 'commands for viewing data', viewCommands)
    .demandCommand()
    .help();
}
