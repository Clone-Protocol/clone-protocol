import { Argv } from 'yargs';

const pools = require('./view/pools');
const borrows = require('./view/borrows');
const portfolio = require('./view/portfolio');
const comet = require('./view/comet');

module.exports = (yargs: Argv) => {
  yargs
    .command(pools)
    .command(borrows)
    .command(portfolio)
    .command(comet)
    .demandCommand()
    .help();
}
