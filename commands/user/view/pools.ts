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

exports.command = "pools";
exports.desc = "View all pools on Clone";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();

    const cloneProgram = getCloneProgram(setup.network, setup.provider);
    const pythProgram = getPythProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();

    for (let i = 0; i < Number(tokenData.numPools); i++) {
      const pool = tokenData.pools[i];

      const feedData = await getFeedData(
        pythProgram,
        pool.assetInfo.pythAddress
      );
      const oraclePrice = feedData.aggregate.price;

      const title = `onAsset Pool ${i}`;
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
        `onAsset Mint: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        //this will change to called quotePrice function on sdk/utils
        `Clone Price: $${chalk.bold(getMantissa(pool.onusdAmount) / getMantissa(pool.onassetAmount))}\n` +
        `onAsset Pool Balance: ${chalk.bold(getMantissa(pool.onassetAmount))}\n` +
        `onUSD Pool Balance: ${chalk.bold(getMantissa(pool.onusdAmount))}\n` +
        `onAsset Pool Address: ${chalk.bold(pool.onassetTokenAccount)}\n` +
        `onUSD Pool Address: ${chalk.bold(pool.onusdTokenAccount)}\n` +
        `Liquidity Token Mint: ${chalk.bold(pool.liquidityTokenMint)}\n` +
        `Liquidity Token Supply: ${chalk.bold(getMantissa(pool.liquidityTokenSupply))}\n` +
        `Trading Fee: ${chalk.bold(getMantissa(pool.liquidityTradingFee))}\n` +
        `Oracle Price: $${chalk.bold(oraclePrice)}\n` +
        `Pyth Address: ${chalk.bold(pool.assetInfo.pythAddress)}\n` +
        `Deprecated: ${chalk.bold(pool.deprecated)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(tokenData.numPools)} Pools`);
  } catch (error: any) {
    errorLog(`Failed to view pools:\n${error.message}`);
  }
};
