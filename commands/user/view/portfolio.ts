import { getPoolLiquidity } from "../../../sdk/src/utils";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getOrCreateAssociatedTokenAccount,
  fromCloneScale,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";

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

    const tokenData = await cloneClient.getTokenData();

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

    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      cloneClient.clone!.onusdMint
    );
    const onusdBalance = fromCloneScale(Number(onusdTokenAccountInfo.amount));
    assetInfo += `onUSD Balance: ${onusdBalance}\n\n`;
    let totalBalance = onusdBalance;

    for (let i = 0; i < Number(tokenData.numPools); i++) {
      const pool = tokenData.pools[i];
      const oracle = tokenData.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.onassetMint
      );

      let { poolOnusd, poolOnasset } = getPoolLiquidity(
        pool,
        Number(oracle.price)
      );
      const quotePrice = poolOnusd / poolOnasset;
      const onassetBalance = fromCloneScale(
        Number(onassetTokenAccountInfo.amount)
      );

      assetInfo += `onAsset ${i}\nBalance: ${onassetBalance}\nQuote Price: ${quotePrice}\n\n`;
      totalBalance += onassetBalance * quotePrice;
    }
    assetInfo += `Total Balance: ${totalBalance}`;
    console.log(boxen(assetInfo, assetBoxenOptions));

    successLog(`Viewing ${Number(tokenData.numPools)} Pools`);
  } catch (error: any) {
    errorLog(`Failed to view pools:\n${error.message}`);
  }
};
