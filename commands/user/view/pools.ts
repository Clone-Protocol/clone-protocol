import { Transaction } from "@solana/web3.js";
import { CloneClient } from "../../../sdk/src/clone";
import { getPoolLiquidity } from "../../../sdk/src/utils";
import { toNumber } from "../../../sdk/src/decimal";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
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

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    let ix = await cloneClient.updatePricesInstruction();
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    const tokenData = await cloneClient.getTokenData();

    for (let i = 0; i < Number(tokenData.numPools); i++) {
      const pool = tokenData.pools[i];

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

      let {poolOnusd, poolOnasset} = getPoolLiquidity(pool);

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `onAsset Mint: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        //this will change to called quotePrice function on sdk/utils
        `Quote Price: $${chalk.bold(poolOnusd / poolOnasset)}\n` +
        `onUSD Pool Balance: ${chalk.bold(poolOnusd)}\n` +
        `onAsset ILD: ${chalk.bold(toNumber(pool.onassetIld))}\n` +
        `onUSD ILD: ${chalk.bold(toNumber(pool.onusdIld))}\n` +
        `Liquidity Trading Fee: %${chalk.bold(toNumber(pool.liquidityTradingFee))}\n` +
        `Treasury Trading Fee: %${chalk.bold(toNumber(pool.treasuryTradingFee))}\n` +
        `Oracle Price: $${chalk.bold(toNumber(pool.assetInfo.price))}\n` +
        `Pyth Address: ${chalk.bold(pool.assetInfo.pythAddress)}\n` +
        `Underlying Token Address: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        `Deprecated: ${chalk.bold(pool.deprecated)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(tokenData.numPools)} Pools`);
  } catch (error: any) {
    errorLog(`Failed to view pools:\n${error.message}`);
  }
};
