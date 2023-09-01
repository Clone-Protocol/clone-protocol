import { Transaction } from "@solana/web3.js";
import { getPoolLiquidity } from "../../../sdk/src/utils";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getStatus,
  COLLATERAL_SCALE,
  fromCloneScale,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";
import { fromScale } from "../../../sdk/src/clone";

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

      let { poolCollateralZeroScale, poolOnassetZeroScale } = getPoolLiquidity(
        pool,
        Number(oracle.price),
        COLLATERAL_SCALE,
        oracle.expo
      );

      const status = getStatus(Number(pool.status));

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `onAsset Mint: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        //this will change to called quotePrice function on sdk/utils
        `Quote Price: $${chalk.bold(
          poolCollateralZeroScale / poolOnassetZeroScale
        )}\n` +
        `Collateral Pool Balance: ${chalk.bold(poolCollateralZeroScale)}\n` +
        `onAsset ILD: ${chalk.bold(
          Number(fromCloneScale(Number(pool.onassetIld)))
        )}\n` +
        `Collateral ILD: ${chalk.bold(
          fromScale(pool.collateralIld, cloneClient.clone.collateral.scale)
        )}\n` +
        `Liquidity Trading Fee: %${chalk.bold(
          Number(pool.liquidityTradingFeeBps)
        )}\n` +
        `Treasury Trading Fee: %${chalk.bold(
          Number(pool.treasuryTradingFeeBps)
        )}\n` +
        `Oracle Price: $${chalk.bold(fromScale(oracle.price, oracle.expo))}\n` +
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
