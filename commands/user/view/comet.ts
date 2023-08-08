import { Transaction } from "@solana/web3.js";
import {
  ONUSD_COLLATERAL_INDEX,
  USDC_COLLATERAL_INDEX,
} from "../../../sdk/src/clone";
import { getHealthScore, getILD } from "../../../sdk/src/healthscore";
import {
  successLog,
  errorLog,
  fromCloneScale,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../../utils";

import chalk from "chalk";
import boxen from "boxen";

exports.command = "comet";
exports.desc = "View your comet position";
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
    const comet = user.comet;

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
        tokenData.collaterals[Number(collateralPosition.collateralIndex)];
      const hasOracle =
        i !== ONUSD_COLLATERAL_INDEX && i !== USDC_COLLATERAL_INDEX;

      let collateralPrice: number;
      if (hasOracle) {
        collateralPrice = Number(
          tokenData.oracles[Number(collateral.oracleInfoIndex)].price
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
          Number(collateralPosition.collateralAmount)
        )}\n` +
        `Collateral Oracle Price: ${chalk.bold(collateralPrice)}\n` +
        `Position Value: $${chalk.bold(
          Number(collateralPosition.collateralAmount) * collateralPrice
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
          fromCloneScale(Number(position.poolIndex))
        )}\n` +
        `onUSD Liquidity Committed: ${chalk.bold(
          Number(position.committedOnusdLiquidity)
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
