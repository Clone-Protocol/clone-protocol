import { Argv } from 'yargs';

const add = require('./stake/add');
const withdraw = require('./stake/withdraw');

module.exports = (yargs: Argv) => {
  yargs
    .command(add)
    .command(withdraw)
    .demandCommand()
    .help();
}
