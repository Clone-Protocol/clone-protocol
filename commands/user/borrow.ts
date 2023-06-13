import { Argv } from 'yargs';

const init = require('./borrow/init');

module.exports = (yargs: Argv) => {
  yargs
    .command(init)
    .demandCommand()
    .help();
}
