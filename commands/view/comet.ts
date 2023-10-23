import { PublicKey } from "@solana/web3.js";
import { fromScale } from "../../sdk/src/clone";
import { getHealthScore, getILD } from "../../sdk/src/healthscore";
import {
  successLog,
  errorLog,
  getCloneData,
  getConnection,
  getUserAddress,
} from "../utils";
import {
  Pools,
  Oracles,
  Clone,
  User,
} from "../../sdk/generated/clone/accounts";
import chalk from "chalk";
import boxen from "boxen";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  userAddress: string;
}

exports.command = "comet";
exports.desc = "View your comet position [user-address]";
exports.builder = (yargs: CommandArguments) => {
  yargs.positional("user-address", {
    describe: "The address of the user whose comet you wish to view",
    type: "string",
    default: "",
  });
};
exports.handler = async function (yargs: CommandArguments) {
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

    let userAddress: PublicKey;
    if (yargs.userAddress) {
      userAddress = new PublicKey(yargs.userAddress);
    } else {
      userAddress = getUserAddress();
    }
    const [userAccountAddress, ___] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), userAddress.toBuffer()],
      cloneProgramID
    );
    const user = await User.fromAccountAddress(connection, userAccountAddress);
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
        fromScale(comet.collateralAmount, collateral.scale)
      )}\n` +
      `Collateral Oracle Price: ${chalk.bold(collateralPrice)}\n` +
      `Position Value: $${chalk.bold(
        fromScale(comet.collateralAmount, collateral.scale) * collateralPrice
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
            collateral.scale
          )
        )}\n` +
        `Collateral Impermanent Loss Debt: ${chalk.bold(ild.collateralILD)}\n` +
        `onAsset Impermanent Loss Debt: ${chalk.bold(ild.onAssetILD)}\n`;

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
