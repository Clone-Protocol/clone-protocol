import { getPoolLiquidity } from "../../../sdk/src/utils";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getOrCreateAssociatedTokenAccount,
  fromCloneScale,
  COLLATERAL_SCALE,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";
import { fromScale } from "../../../sdk/src/clone";

exports.command = "portfolio";
exports.desc = "View your wallet balances for all of Clone's assets";
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

    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      cloneClient.clone.collateral.mint
    );
    const collateralBalance = fromScale(
      Number(collateralTokenAccountInfo.amount),
      cloneClient.clone.collateral.scale
    );
    assetInfo += `Collateral Balance: ${collateralBalance}\n\n`;
    let totalBalance = collateralBalance;

    for (let i = 0; i < Number(pools.pools.length); i++) {
      const pool = pools.pools[i];
      const oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.onassetMint
      );

      let { poolCollateralZeroScale, poolOnassetZeroScale } = getPoolLiquidity(
        pool,
        Number(oracle.price),
        COLLATERAL_SCALE,
        oracle.expo
      );
      const quotePrice = poolCollateralZeroScale / poolOnassetZeroScale;
      const onassetBalance = fromCloneScale(
        Number(onassetTokenAccountInfo.amount)
      );

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
