import { Argv } from 'yargs';

const init = require('./borrow/init');
const addCollateral = require('./borrow/add-collateral');
const withdrawCollateral = require('./borrow/withdraw-collateral');
const borrowMore = require('./borrow/borrow-more');
const payDebt = require('./borrow/pay-debt');

module.exports = (yargs: Argv) => {
  yargs
    .command(init)
    .command(addCollateral)
    .command(withdrawCollateral)
    .command(borrowMore)
    .command(payDebt)
    .demandCommand()
    .help();
}
