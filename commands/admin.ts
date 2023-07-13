import { Argv } from 'yargs';

const initClone = require('./admin/init-clone');
const initMockJup = require('./admin/init-mock-jup');
const addPool = require('./admin/add-pool');
const addCollateral = require('./admin/add-collateral');
const updatePrices = require('./admin/update-prices');

module.exports = (yargs: Argv) => {
  yargs
    .command(initClone)
    .command(initMockJup)
    .command(addPool)
    .command(addCollateral)
    .command(updatePrices)
    .demandCommand()
    .help();
}
