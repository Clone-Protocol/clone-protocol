import { PublicKey } from "@solana/web3.js";
import { getPoolLiquidity } from "../../sdk/src/utils";
import {
  successLog,
  errorLog,
  getCloneData,
  getStatus,
  COLLATERAL_SCALE,
  fromCloneScale,
  getConnection,
} from "../utils";
import { Pools, Oracles, Clone } from "../../sdk/generated/clone/accounts";
import chalk from "chalk";
import boxen from "boxen";
import { fromScale } from "../../sdk/src/clone";

exports.command = "pools";
exports.desc = "View all pools on Clone";
exports.builder = {};
exports.handler = async function () {
  try {
    const connection = getConnection();
    const [cloneProgramID, cloneAddress] = getCloneData();

    const [poolsAddress, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("pools")],
      cloneProgramID
    );
    const [oraclesAddress, __] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracles")],
      cloneProgramID
    );

    const pools = await Pools.fromAccountAddress(connection, poolsAddress);
    const oracles = await Oracles.fromAccountAddress(
      connection,
      oraclesAddress
    );
    const clone = await Clone.fromAccountAddress(connection, cloneAddress);

    const collateral = clone.collateral;

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
          fromScale(poolCollateral, collateral.scale) /
            fromCloneScale(poolOnasset)
        )}\n` +
        `Collateral Pool Balance: ${chalk.bold(
          fromCloneScale(poolCollateral)
        )}\n` +
        `onAsset ILD: ${chalk.bold(
          Number(fromCloneScale(Number(pool.onassetIld)))
        )}\n` +
        `Collateral ILD: ${chalk.bold(
          fromScale(pool.collateralIld, collateral.scale)
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
