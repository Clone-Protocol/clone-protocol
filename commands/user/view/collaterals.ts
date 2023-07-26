import { Transaction } from "@solana/web3.js";
import {
  CloneClient,
  ONUSD_COLLATERAL_INDEX,
  USDC_COLLATERAL_INDEX,
} from "../../../sdk/src/clone";
import { toNumber } from "../../../sdk/src/decimal";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getStatus,
} from "../../utils";
import chalk from "chalk";
import boxen from "boxen";

exports.command = "collaterals";
exports.desc = "View all collaterals on Clone";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();

    const cloneProgram = getCloneProgram(setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    let ix = await cloneClient.updatePricesInstruction();
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    const tokenData = await cloneClient.getTokenData();

    for (let i = 0; i < Number(tokenData.numCollaterals); i++) {
      const collateral = tokenData.collaterals[i];
      const hasOracle =
        i !== ONUSD_COLLATERAL_INDEX && i !== USDC_COLLATERAL_INDEX;

      let oraclePrice: number;
      let oracleInfoIndexString: string;
      let priceFeedString: string;
      if (hasOracle) {
        const oracleInfoIndex = collateral.oracleInfoIndex.toNumber();
        oraclePrice = toNumber(tokenData.oracles[oracleInfoIndex].price);
        const priceFeed = tokenData.oracles[oracleInfoIndex].pythAddress;
        oracleInfoIndexString = oracleInfoIndex.toString();
        priceFeedString = priceFeed.toString();
      } else {
        oracleInfoIndexString = "NA";
        oraclePrice = 1;
        priceFeedString = "NA";
      }

      const status = getStatus(collateral.status);

      const title = `Collateral ${i}`;
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
        `Mint: ${chalk.bold(collateral.mint)}\n` +
        `Vault: ${chalk.bold(collateral.vault)}\n` +
        `Vault Comet Supply: ${chalk.bold(
          toNumber(collateral.vaultCometSupply)
        )}\n` +
        `Vault Borrow Supply: ${chalk.bold(
          toNumber(collateral.vaultMintSupply)
        )}\n` +
        `Vault OnUSD Supply: ${chalk.bold(
          toNumber(collateral.vaultOnusdSupply)
        )}\n` +
        `Oracle Price: $${chalk.bold(oraclePrice)}\n` +
        `Pyth Address: ${chalk.bold(priceFeedString)}\n` +
        `Oracle Index: ${chalk.bold(oracleInfoIndexString)}\n` +
        `Status: ${chalk.bold(status)}\n`;
      console.log(boxen(assetInfo, assetBoxenOptions));
    }

    successLog(`Viewing ${Number(tokenData.numCollaterals)} collaterals`);
  } catch (error: any) {
    errorLog(`Failed to view collaterals:\n${error.message}`);
  }
};
