import { Argv } from 'yargs';

const init = require('./user/init');
const swap = require('./user/swap');
const borrowCommands = require('./user/borrow');
const cometCommands = require('./user/comet');
const stakeCommands = require('./user/stake');

module.exports = (yargs: Argv) => {
  yargs
    .command(init)
    .command(swap)
    .command('borrow <command>', 'commands for managing borrow positions', borrowCommands)
    .command('comet <command>', 'commands for managing your comet', cometCommands)
    .command('stake <command>', 'commands for managing $CLN staking', stakeCommands)
    .demandCommand()
    .help();
}
