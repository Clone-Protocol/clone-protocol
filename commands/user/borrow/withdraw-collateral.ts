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
  borrowIndex: number;
  amount: number;
}

exports.command = "withdraw-collateral <borrow-index> <amount>";
exports.desc = "Withdraws collateral from your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("borrow-index", {
      describe: "The index of the borrow position",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral to withdraw from the borrow position",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();
    const borrowPosition = (await cloneClient.getBorrowPositions())
      .borrowPositions[yargs.borrowIndex];

    const collateral = tokenData.collaterals[borrowPosition.collateralIndex];

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      collateral.mint
    );

    let upgradePricesIx = await cloneClient.updatePricesInstruction();

    const amount = new BN(
      `${toScale(
        yargs.amount,
        Number(toDecimal(collateral.vaultMintSupply).scale())
      )}`
    );

    let ix = await cloneClient.withdrawCollateralFromBorrowInstruction(
      yargs.borrowIndex,
      collateralTokenAccountInfo.address,
      amount
    );
    await setup.provider.sendAndConfirm(
      new Transaction().add(upgradePricesIx).add(ix)
    );

    successLog(`${yargs.amount} Collateral Withdraw!`);
  } catch (error: any) {
    errorLog(
      `Failed to withdraw collateral from borrow position:\n${error.message}`
    );
  }
};