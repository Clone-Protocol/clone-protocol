import { CloneClient } from "../../../sdk/src/clone";
import { getFeedData } from "../../../sdk/src/oracle";
import { getMantissa } from "../../../sdk/src/decimal";
import {
  successLog,
  errorLog,
  fromDevnetScale,
  anchorSetup,
  getCloneProgram,
  getPythProgram,
} from "../../utils";

import chalk from "chalk";
import boxen from "boxen";

exports.command = "borrow-positions";
exports.desc = "Adds collateral to your borrow position";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);
    const pythProgram = getPythProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();
    const borrowPositions = await cloneClient.getBorrowPositions();

    for (let i = 0; i < Number(borrowPositions.numPositions); i++) {
      const borrowPosition = borrowPositions.borrowPositions[i];

      const pool = tokenData.pools[borrowPosition.poolIndex];
      const collateral = tokenData.collaterals[borrowPosition.collateralIndex];

      const stable = Number(collateral.stable);
      let collateralPrice: number;
      let minimumCollateralRatio: number;
      if (stable === 0) {
        const collateralPoolIndex = Number(collateral.poolIndex);
        const priceFeed =
          tokenData.pools[collateralPoolIndex].assetInfo.pythAddress;
        const feedData = await getFeedData(pythProgram, priceFeed);
        collateralPrice = feedData.aggregate.price;
        minimumCollateralRatio = getMantissa(
          pool.assetInfo.cryptoCollateralRatio
        );
      } else {
        collateralPrice = 1;
        minimumCollateralRatio = getMantissa(
          pool.assetInfo.stableCollateralRatio
        );
      }
      const priceFeed = pool.assetInfo.pythAddress;
      const feedData = await getFeedData(pythProgram, priceFeed);
      let onAssetPrice = feedData.aggregate.price;

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
        `Collateral Amount: ${chalk.bold(
          fromDevnetScale(getMantissa(borrowPosition.collateralAmount))
        )}\n` +
        `Borrowed onAsset Amount: ${chalk.bold(
          fromDevnetScale(getMantissa(borrowPosition.borrowedOnasset))
        )}\n` +
        `Collateral Oracle Price: $${chalk.bold(collateralPrice)}\n` +
        `onAsset Oracle Price: $${chalk.bold(onAssetPrice)}\n` +
        `Current Collateral Ratio: %${chalk.bold(
          100 *
            ((getMantissa(borrowPosition.collateralAmount) * collateralPrice) /
              (getMantissa(borrowPosition.borrowedOnasset) * onAssetPrice))
        )}\n` +
        `Minimum Collateral Ratio: %${chalk.bold(minimumCollateralRatio)}\n`;

      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(
      `Viewing ${Number(borrowPositions.numPositions)} Borrow Positions!`
    );
  } catch (error: any) {
    errorLog(`Failed to view borrow positions:\n${error.message}`);
  }
};
