import { PublicKey } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  getConnection,
  getCloneData,
  fromCloneScale,
  getUserAddress,
} from "../utils";

import chalk from "chalk";
import boxen from "boxen";
import { fromScale } from "../../sdk/src/clone";
import {
  Pools,
  Oracles,
  Clone,
  User,
} from "../../sdk/generated/clone/accounts";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  userAddress: string;
}

exports.command = "borrows [user-address]";
exports.desc = "View your borrow positions";
exports.builder = (yargs: CommandArguments) => {
  yargs.positional("user-address", {
    describe: "The address of the user whose positions you wish to view",
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
    const borrows = user.borrows;

    for (let i = 0; i < Number(borrows.length); i++) {
      const borrowPosition = borrows[i];
      const pool = pools.pools[Number(borrowPosition.poolIndex)];

      const collateralPrice = fromScale(
        oracles.oracles[Number(collateral.oracleInfoIndex)].price,
        oracles.oracles[Number(collateral.oracleInfoIndex)].expo
      );

      let minOvercollateralRatio = Number(
        pool.assetInfo.minOvercollateralRatio
      );
      let maxLiquidationOvercollateralRatio = Number(
        pool.assetInfo.maxLiquidationOvercollateralRatio
      );

      let onAssetPrice = fromScale(
        oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)].price,
        oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)].expo
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
        `Pool Index: ${chalk.bold(borrowPosition.poolIndex)}\n` +
        `Collateral Amount: ${chalk.bold(
          fromScale(borrowPosition.collateralAmount, collateral.scale)
        )}\n` +
        `Borrowed onAsset Amount: ${chalk.bold(
          fromCloneScale(Number(borrowPosition.borrowedOnasset))
        )}\n` +
        `Collateral Oracle Price: $${chalk.bold(collateralPrice)}\n` +
        `onAsset Oracle Price: $${chalk.bold(onAssetPrice)}\n` +
        `Current Collateral Ratio: %${chalk.bold(
          (100 *
            (fromScale(borrowPosition.collateralAmount, collateral.scale) *
              collateralPrice)) /
            (fromCloneScale(Number(borrowPosition.borrowedOnasset)) *
              onAssetPrice)
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
