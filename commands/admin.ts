import { Argv } from 'yargs';

const initClone = require('./admin/init-clone');
const initStaking = require('./admin/init-staking');
const addPool = require('./admin/add-pool');
const addOracle = require('./admin/add-oracle');
const updatePrices = require('./admin/update-prices');

module.exports = (yargs: Argv) => {
  yargs
    .command(initClone)
    .command(initStaking)
    .command(addPool)
    .command(addOracle)
    .command(updatePrices)
    .demandCommand()
    .help();
}
