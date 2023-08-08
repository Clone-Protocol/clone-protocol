import { Transaction } from "@solana/web3.js";
import {
  ONUSD_COLLATERAL_INDEX,
  USDC_COLLATERAL_INDEX,
} from "../../../sdk/src/clone";
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

    const tokenData = await cloneClient.getTokenData();

    let ix = cloneClient.updatePricesInstruction(tokenData);
    await provider.sendAndConfirm(new Transaction().add(ix));

    const user = await cloneClient.getUserAccount();
    const borrows = user.borrows;

    for (let i = 0; i < Number(borrows.numPositions); i++) {
      const borrowPosition = borrows.positions[i];

      const pool = tokenData.pools[Number(borrowPosition.poolIndex)];
      const collateralIndex = Number(borrowPosition.collateralIndex);
      const collateral = tokenData.collaterals[collateralIndex];

      const hasOracle =
        collateralIndex !== ONUSD_COLLATERAL_INDEX &&
        collateralIndex !== USDC_COLLATERAL_INDEX;
      let collateralPrice: number;
      if (hasOracle) {
        collateralPrice = Number(
          tokenData.oracles[Number(collateral.oracleInfoIndex)].price
        );
      } else {
        collateralPrice = 1;
      }

      let minOvercollateralRatio = Number(
        pool.assetInfo.minOvercollateralRatio
      );
      let maxLiquidationOvercollateralRatio = Number(
        pool.assetInfo.maxLiquidationOvercollateralRatio
      );

      let onAssetPrice = Number(
        tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)].price
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

    successLog(`Viewing ${Number(borrows.numPositions)} Borrow Positions!`);
  } catch (error: any) {
    errorLog(`Failed to view borrow positions:\n${error.message}`);
  }
};
