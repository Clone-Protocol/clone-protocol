import { Argv } from 'yargs';

const initAccount = require('./user/init-account');

module.exports = (yargs: Argv) => {
  yargs
    .command(initAccount)
    .demandCommand()
    .help();
}
