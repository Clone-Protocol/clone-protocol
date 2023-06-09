import { CloneClient } from "../../../sdk/src/clone";
import { getFeedData } from "../../../sdk/src/oracle";
import { getMantissa } from "../../../sdk/src/decimal";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getPythProgram,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "collaterals";
exports.desc = "View all collaterals on Clone";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();

    const cloneProgram = getCloneProgram(setup.network, setup.provider);
    const pythProgram = getPythProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider)
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();

    for (let i = 0; i < Number(tokenData.numCollaterals); i++) {
      const collateral = tokenData.collaterals[i];

      const stable = Number(collateral.stable);
      let oraclePrice: number;
      let poolIndex: number;
      let priceFeedString: string;
      if (stable === 0) {
        poolIndex = Number(collateral.poolIndex);
        const priceFeed = tokenData.pools[poolIndex].assetInfo.pythAddress;
        const feedData = await getFeedData(pythProgram, priceFeed);
        oraclePrice = feedData.aggregate.price;
        priceFeedString = priceFeed.toString();
      } else {
        oraclePrice = 1;
        poolIndex = 255;
        priceFeedString = "NA";
      }

      const title = `Collateral ${i}`;
      const underline = new Array(title.length).fill("-").join("");

      const assetBoxenOptions: boxen.Options = {
        padding: 1,
        margin: 1,
        // @ts-ignore
        borderStyle: "double",
        borderColor: "green",
        backgroundColor: "#CCCCCC",
      };

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `Mint: ${chalk.bold(collateral.mint)}\n` +
        `Vault: ${chalk.bold(collateral.vault)}\n` +
        `Vault Comet Supply: ${chalk.bold(getMantissa(collateral.vaultCometSupply))}\n` +
        `Vault Borrow Supply: ${chalk.bold(getMantissa(collateral.vaultMintSupply))}\n` +
        `Vault OnUSD Supply: ${chalk.bold(getMantissa(collateral.vaultOnusdSupply))}\n` +
        `Stable: ${chalk.bold(stable)}\n` +
        `Oracle Price: ${chalk.bold(oraclePrice)}\n` +
        `Pyth Address: ${chalk.bold(priceFeedString)}\n` +
        `Pool Index: ${chalk.bold(poolIndex)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(tokenData.numCollaterals)} collaterals`);
  } catch (error: any) {
    errorLog(`Failed to view collaterals:\n${error.message}`);
  }
};
