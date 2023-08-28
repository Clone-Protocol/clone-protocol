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

    const pools = await cloneClient.getPools();
    const oracles = await cloneClient.getOracles();

    let ix = cloneClient.updatePricesInstruction(oracles);
    await provider.sendAndConfirm(new Transaction().add(ix));

    for (let i = 0; i < Number(pools.pools.length); i++) {
      const pool = pools.pools[i];
      const oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

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

      let { poolCollateral, poolOnasset } = getPoolLiquidity(
        pool,
        Number(oracle.price)
      );

      const status = getStatus(Number(pool.status));

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `onAsset Mint: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        //this will change to called quotePrice function on sdk/utils
        `Quote Price: $${chalk.bold(poolCollateral / poolOnasset)}\n` +
        `onUSD Pool Balance: ${chalk.bold(poolCollateral)}\n` +
        `onAsset ILD: ${chalk.bold(Number(pool.onassetIld))}\n` +
        `onUSD ILD: ${chalk.bold(Number(pool.collateralIld))}\n` +
        `Liquidity Trading Fee: %${chalk.bold(
          Number(pool.liquidityTradingFeeBps)
        )}\n` +
        `Treasury Trading Fee: %${chalk.bold(
          Number(pool.treasuryTradingFeeBps)
        )}\n` +
        `Oracle Price: $${chalk.bold(Number(oracle.price))}\n` +
        `Oracle Type: ${chalk.bold(
          oracle.source == 0 ? "Pyth" : "Switchboard"
        )}\n` +
        `Oracle Address: ${chalk.bold(oracle.address)}\n` +
        `Underlying Token Address: ${chalk.bold(
          pool.assetInfo.onassetMint
        )}\n` +
        `Status: ${chalk.bold(status)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(pools.pools.length)} Pools`);
  } catch (error: any) {
    errorLog(`Failed to view pools:\n${error.message}`);
  }
};
