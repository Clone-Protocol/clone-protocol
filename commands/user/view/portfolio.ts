import { CloneClient } from "../../../sdk/src/clone";
import { getPoolLiquidity } from "../../../sdk/src/utils";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getOrCreateAssociatedTokenAccount,
  fromDevnetScale,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "portfolio";
exports.desc = "View your wallet balances for all of Clone's assets";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();

    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

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
      setup.provider,
      cloneClient.clone!.onusdMint
    );
    const onusdBalance = fromDevnetScale(Number(onusdTokenAccountInfo.amount));
    assetInfo += `onUSD Balance: ${onusdBalance}\n\n`;
    let totalBalance = onusdBalance;

    for (let i = 0; i < Number(tokenData.numPools); i++) {
      const pool = tokenData.pools[i];

      let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        setup.provider,
        pool.assetInfo.onassetMint
      );

      let { poolOnusd, poolOnasset } = getPoolLiquidity(pool);
      const quotePrice = poolOnusd / poolOnasset;
      const onassetBalance = fromDevnetScale(
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
