import { Argv } from 'yargs';

const pools = require('./view/pools');
const borrowPositions = require('./view/borrow-positions');
const portfolio = require('./view/portfolio');
const comet = require('./view/comet');

module.exports = (yargs: Argv) => {
  yargs
    .command(pools)
    .command(borrowPositions)
    .command(portfolio)
    .command(comet)
    .demandCommand()
    .help();
}
