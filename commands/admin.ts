import { Argv } from 'yargs';

const initClone = require('./admin/init-clone');
const initStaking = require('./admin/init-staking');
const addPool = require('./admin/add-pool');
const updatePrices = require('./admin/update-prices');

module.exports = (yargs: Argv) => {
  yargs
    .command(initClone)
    .command(initStaking)
    .command(addPool)
    .command(updatePrices)
    .demandCommand()
    .help();
}
