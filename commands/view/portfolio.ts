import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getPoolLiquidity } from "../../sdk/src/utils";
import {
  successLog,
  errorLog,
  getCloneData,
  getOrCreateAssociatedTokenAccount,
  fromCloneScale,
  COLLATERAL_SCALE,
  getConnection,
  getUserAddress,
} from "../utils";
import { Pools, Oracles, Clone } from "../../sdk/generated/clone/accounts";
import chalk from "chalk";
import boxen from "boxen";
import { fromScale } from "../../sdk/src/clone";
import { Argv } from "yargs";
import { getAssociatedTokenAddress } from "@solana/spl-token";

interface CommandArguments extends Argv {
  userAddress: string;
}

exports.command = "portfolio";
exports.desc = "View your wallet balances for all of Clone's assets";
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
    const assetBoxenOptions: boxen.Options = {
      padding: 1,
      margin: 1,
      // @ts-ignore
      borderStyle: "double",
      borderColor: "green",
      backgroundColor: "#CCCCCC",
    };

    const title = `Wallet Balances`;
    const underline = new Array(title.length).fill("-").join("");

    let assetInfo = `${chalk.bold(title)}\n` + `${underline}\n`;

    let totalBalance = 0;
    let collateralBalance = 0;
    let associatedCollateralAccountAddress = await getAssociatedTokenAddress(
      collateral.mint,
      userAddress
    );
    let collateralTokenAccountInfo = await connection.getParsedAccountInfo(
      associatedCollateralAccountAddress
    );
    if (collateralTokenAccountInfo.value) {
      collateralBalance = fromScale(
        Number(
          //@ts-expect-error
          collateralTokenAccountInfo.value.data.parsed.info.tokenAmount.amount
        ),
        collateral.scale
      );
    }
    const collateralPrice = fromScale(
      Number(oracles.oracles[collateral.oracleInfoIndex].price),
      oracles.oracles[collateral.oracleInfoIndex].expo
    );
    assetInfo += `Collateral Balance: ${collateralBalance}\nCollateral Quote Price: ${collateralPrice}\n\n`;
    totalBalance += collateralBalance * collateralPrice;

    for (let i = 0; i < Number(pools.pools.length); i++) {
      const pool = pools.pools[i];
      const oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      let onassetBalance = 0;
      let associatedOnassetAccountAddress = await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        userAddress
      );
      let onassetTokenAccountInfo = await connection.getParsedAccountInfo(
        associatedOnassetAccountAddress
      );
      if (onassetTokenAccountInfo.value) {
        onassetBalance = fromCloneScale(
          Number(
            //@ts-expect-error
            onassetTokenAccountInfo.value.data.parsed.info.tokenAmount.amount
          )
        );
      }

      let { poolCollateral, poolOnasset } = getPoolLiquidity(
        pool,
        Number(oracle.price),
        COLLATERAL_SCALE,
        oracle.expo
      );
      const quotePrice =
        fromScale(poolCollateral, collateral.scale) /
        fromCloneScale(poolOnasset);

      assetInfo += `onAsset ${i}\nBalance: ${onassetBalance}\nQuote Price: ${quotePrice}\n\n`;
      totalBalance += onassetBalance * quotePrice;
    }
    assetInfo += `Total Balance: ${totalBalance}`;
    console.log(boxen(assetInfo, assetBoxenOptions));

    successLog(`Viewing Portfolio`);
  } catch (error: any) {
    errorLog(`Failed to view portfolio:\n${error.message}`);
  }
};
