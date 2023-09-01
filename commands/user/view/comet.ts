import { Transaction } from "@solana/web3.js";
import { fromScale } from "../../../sdk/src/clone";
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
import { Collateral } from "../../../sdk/generated/clone/types/Collateral";

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

    const pools = await cloneClient.getPools();
    const oracles = await cloneClient.getOracles();
    const collateral = cloneClient.clone.collateral;

    let ix = cloneClient.updatePricesInstruction(oracles);
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

    const collateralPrice = fromScale(
      oracles.oracles[Number(collateral.oracleInfoIndex)].price,
      oracles.oracles[Number(collateral.oracleInfoIndex)].expo
    );

    let title = `Collateral Position`;
    let underline = new Array(title.length).fill("-").join("");

    let assetInfo =
      `${chalk.bold(title)}\n` +
      `${underline}\n` +
      `Collateral Amount: ${chalk.bold(
        fromScale(comet.collateralAmount, cloneClient.clone.collateral.scale)
      )}\n` +
      `Collateral Oracle Price: ${chalk.bold(collateralPrice)}\n` +
      `Position Value: $${chalk.bold(
        fromScale(comet.collateralAmount, cloneClient.clone.collateral.scale) *
          collateralPrice
      )}\n`;

    console.log(boxen(assetInfo, assetBoxenOptions));

    for (let i = 0; i < Number(comet.positions.length); i++) {
      const position = comet.positions[i];

      const title = `Liquidity Position ${i}`;
      const underline = new Array(title.length).fill("-").join("");

      const ild = getILD(collateral, pools, oracles, comet)[i];

      const assetInfo =
        `${chalk.bold(title)}\n` +
        `${underline}\n` +
        `onAsset Pool Index: ${chalk.bold(position.poolIndex)}\n` +
        `Collateral Liquidity Committed: ${chalk.bold(
          fromScale(
            Number(position.committedCollateralLiquidity),
            cloneClient.clone.collateral.scale
          )
        )}\n` +
        `Collateral Impermanent Loss Debt: ${chalk.bold(
          fromScale(ild.collateralILD, cloneClient.clone.collateral.scale)
        )}\n` +
        `onAsset Impermanent Loss Debt: ${chalk.bold(
          fromCloneScale(ild.onAssetILD)
        )}\n`;

      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    const healthScore = getHealthScore(
      oracles,
      pools,
      comet,
      collateral
    ).healthScore;

    title = `Health Score`;
    underline = new Array(title.length).fill("-").join("");

    assetInfo =
      `${chalk.bold(title)}\n` +
      `${underline}\n` +
      `${chalk.bold(healthScore)}`;

    console.log(boxen(assetInfo, assetBoxenOptions));

    successLog(
      `Viewing Comet with ${Number(
        comet.positions.length
      )} Liquidity Positions!`
    );
  } catch (error: any) {
    errorLog(`Failed to view comet:\n${error.message}`);
  }
};
