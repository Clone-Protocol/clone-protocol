import { Transaction } from "@solana/web3.js";
import { CloneClient, toScale } from "../../../sdk/src/clone";
import { toDecimal } from "../../../sdk/src/decimal";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getOrCreateAssociatedTokenAccount,
} from "../../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  collateralIndex: number;
  amount: number;
}

exports.command = "add-collateral <collateral-index> <amount>";
exports.desc = "Adds collateral to your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("collateral-index", {
      describe: "The index of the collateral you are providing",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral to add to the comet position",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();

    const collateral = tokenData.collaterals[yargs.collateralIndex];

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      collateral.mint
    );

    const amount = new BN(`${toScale(yargs.amount, Number(toDecimal(collateral.vaultMintSupply).scale()))}`);

    let ix = await cloneClient.addCollateralToCometInstruction(
      collateralTokenAccountInfo.address,
      amount,
      yargs.collateralIndex
    );
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} Collateral Added!`);
  } catch (error: any) {
    errorLog(`Failed to add collateral to comet position:\n${error.message}`);
  }
};
