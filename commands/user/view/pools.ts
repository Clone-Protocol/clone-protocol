import { Transaction } from "@solana/web3.js";
import { getPoolLiquidity } from "../../../sdk/src/utils";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getStatus,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "pools";
exports.desc = "View all pools on Clone";
exports.builder = {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const tokenData = await cloneClient.getTokenData();

    let ix = cloneClient.updatePricesInstruction(tokenData);
    await provider.sendAndConfirm(new Transaction().add(ix));

    for (let i = 0; i < Number(tokenData.numPools); i++) {
      const pool = tokenData.pools[i];
      const oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

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

      let { poolOnusd, poolOnasset } = getPoolLiquidity(
        pool,
        Number(oracle.price)
      );

      const status = getStatus(Number(pool.status));

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `onAsset Mint: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        //this will change to called quotePrice function on sdk/utils
        `Quote Price: $${chalk.bold(poolOnusd / poolOnasset)}\n` +
        `onUSD Pool Balance: ${chalk.bold(poolOnusd)}\n` +
        `onAsset ILD: ${chalk.bold(Number(pool.onassetIld))}\n` +
        `onUSD ILD: ${chalk.bold(Number(pool.onusdIld))}\n` +
        `Liquidity Trading Fee: %${chalk.bold(
          Number(pool.liquidityTradingFee)
        )}\n` +
        `Treasury Trading Fee: %${chalk.bold(
          Number(pool.treasuryTradingFee)
        )}\n` +
        `Oracle Price: $${chalk.bold(Number(oracle.price))}\n` +
        `Pyth Address: ${chalk.bold(oracle.pythAddress)}\n` +
        `Underlying Token Address: ${chalk.bold(
          pool.assetInfo.onassetMint
        )}\n` +
        `Status: ${chalk.bold(status)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(tokenData.numPools)} Pools`);
  } catch (error: any) {
    errorLog(`Failed to view pools:\n${error.message}`);
  }
};
