import { Transaction } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../../utils";

import chalk from "chalk";
import boxen from "boxen";

exports.command = "borrow-positions";
exports.desc = "View your borrow positions";
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
    const collateral = cloneClient.clone.collateral;

    let ix = cloneClient.updatePricesInstruction(oracles);
    await provider.sendAndConfirm(new Transaction().add(ix));

    const user = await cloneClient.getUserAccount();
    const borrows = user.borrows;

    for (let i = 0; i < Number(borrows.length); i++) {
      const borrowPosition = borrows[i];
      const pool = pools.pools[Number(borrowPosition.poolIndex)];

      const collateralPrice = Number(
        oracles.oracles[Number(collateral.oracleInfoIndex)].price
      );

      let minOvercollateralRatio = Number(
        pool.assetInfo.minOvercollateralRatio
      );
      let maxLiquidationOvercollateralRatio = Number(
        pool.assetInfo.maxLiquidationOvercollateralRatio
      );

      let onAssetPrice = Number(
        oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)].price
      );

      const title = `Borrow Position ${i}`;
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
        `Collateral Mint: ${chalk.bold(collateral.mint)}\n` +
        `onAsset Mint: ${chalk.bold(pool.assetInfo.onassetMint)}\n` +
        `Collateral Amount: ${chalk.bold(
          Number(borrowPosition.collateralAmount)
        )}\n` +
        `Borrowed onAsset Amount: ${chalk.bold(
          Number(borrowPosition.borrowedOnasset)
        )}\n` +
        `Collateral Oracle Price: $${chalk.bold(collateralPrice)}\n` +
        `onAsset Oracle Price: $${chalk.bold(onAssetPrice)}\n` +
        `Current Collateral Ratio: %${chalk.bold(
          (100 * (Number(borrowPosition.collateralAmount) * collateralPrice)) /
            (Number(borrowPosition.borrowedOnasset) * onAssetPrice)
        )}\n` +
        `Minimum Overcollateral Ratio: %${chalk.bold(
          minOvercollateralRatio
        )}\n` +
        `Maximum Liquidation Overcollateral Ratio: %${chalk.bold(
          maxLiquidationOvercollateralRatio
        )}\n`;

      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(borrows.length)} Borrow Positions!`);
  } catch (error: any) {
    errorLog(`Failed to view borrow positions:\n${error.message}`);
  }
};
