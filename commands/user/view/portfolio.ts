import { CloneClient } from "../../../sdk/src/clone";
import { getFeedData } from "../../../sdk/src/oracle";
import { getMantissa } from "../../../sdk/src/decimal";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getPythProgram,
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
    const pythProgram = getPythProgram(setup.network, setup.provider);

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

    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      cloneClient.clone!.onusdMint
    );
    const onusdBalance = fromDevnetScale(Number(onusdTokenAccountInfo.amount));
    let assetInfo = `onUSD Balance: ${onusdBalance}\n\n`;
    let totalBalance = onusdBalance;

    for (let i = 0; i < Number(tokenData.numPools); i++) {
      const pool = tokenData.pools[i];

      let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        setup.provider,
        pool.assetInfo.onassetMint
      );

      const clonePrice =
        getMantissa(pool.onusdAmount) / getMantissa(pool.onassetAmount);
      const onassetBalance = fromDevnetScale(
        Number(onassetTokenAccountInfo.amount)
      );

      assetInfo += `onAsset ${i} Balance: ${onassetBalance}\nClone Price: ${clonePrice}\n\n`;
      totalBalance += onassetBalance * clonePrice;
    }
    assetInfo += `Total Balance: ${totalBalance}`;
    console.log(boxen(assetInfo, assetBoxenOptions));

    successLog(`Viewing ${Number(tokenData.numPools)} Pools`);
  } catch (error: any) {
    errorLog(`Failed to view pools:\n${error.message}`);
  }
};
