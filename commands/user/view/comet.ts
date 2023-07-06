import { Transaction } from "@solana/web3.js";
import { CloneClient } from "../../../sdk/src/clone";
import { toNumber } from "../../../sdk/src/decimal";
import { getHealthScore, getILD } from "../../../sdk/src/healthscore";
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

exports.command = "comet";
exports.desc = "View your comet position";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);
    const pythProgram = getPythProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    let ix = await cloneClient.updatePricesInstruction();
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    const tokenData = await cloneClient.getTokenData();
    const comet = await cloneClient.getComet();

    const assetBoxenOptions: boxen.Options = {
      padding: 1,
      margin: 1,
      // @ts-ignore
      borderStyle: "double",
      borderColor: "green",
      backgroundColor: "#CCCCCC",
    };

    for (let i = 0; i < Number(comet.numCollaterals); i++) {
      const collateralPosition = comet.collaterals[i];

      const collateral =
        tokenData.collaterals[collateralPosition.collateralIndex];

      const stable = Number(collateral.stable);
      let collateralPrice: number;
      if (stable === 0) {
        const collateralPoolIndex = Number(collateral.poolIndex);

        collateralPrice = toNumber(
          tokenData.pools[collateralPoolIndex].assetInfo.price
        );
      } else {
        collateralPrice = 1;
      }

      const title = `Collateral Position ${i}`;
      const underline = new Array(title.length).fill("-").join("");

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `Collateral Index: ${chalk.bold(
          collateralPosition.collateralIndex
        )}\n` +
        `Collateral Amount: ${chalk.bold(
          toNumber(collateralPosition.collateralAmount)
        )}\n` +
        `Collateral Oracle Price: ${chalk.bold(collateralPrice)}\n` +
        `Position Value: $${chalk.bold(
          toNumber(collateralPosition.collateralAmount) * collateralPrice
        )}\n`;

      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    for (let i = 0; i < Number(comet.numPositions); i++) {
      const position = comet.positions[i];

      const title = `Liquidity Position ${i}`;
      const underline = new Array(title.length).fill("-").join("");

      const ild = getILD(tokenData, comet)[i];

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `onAsset Pool Index: ${chalk.bold(
          fromDevnetScale(position.poolIndex)
        )}\n` +
        `onUSD Liquidity Committed: ${chalk.bold(
          toNumber(position.committedOnusdLiquidity)
        )}\n` +
        `onUSD Impermanent Loss Debt: ${chalk.bold(ild.onusdILD)}\n` +
        `onAsset Impermanent Loss Debt: ${chalk.bold(ild.onAssetILD)}\n`;

      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    const healthScore = getHealthScore(tokenData, comet).healthScore;

    const title = `Health Score`;
    const underline = new Array(title.length).fill("-").join("");

    const assetInfo =
      `${chalk.bold(title)}\n` +
      `${underline}\n` +
      `${chalk.bold(healthScore)}`;

    console.log(boxen(assetInfo, assetBoxenOptions));

    successLog(
      `Viewing ${Number(
        comet.numCollaterals
      )} Collateral Positions and ${Number(
        comet.numPositions
      )} Liquidity Positions From Your Comet!`
    );
  } catch (error: any) {
    errorLog(`Failed to view comet:\n${error.message}`);
  }
};
