import { Transaction } from "@solana/web3.js";
import { CloneClient, toDevnetScale, toScale } from "../../../sdk/src/clone";
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
  poolIndex: number;
  collateralIndex: number;
  collateralAmount: number;
  borrowAmount: number;
}

exports.command =
  "init <pool-index> <collateral-index> <collateral-amount> <borrow-amount>";
exports.desc = "Initializes your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("pool-index", {
      describe: "The index of the onAsset pool you wish to borrow",
      type: "number",
    })
    .positional("collateral-index", {
      describe: "The index of the collateral you wish to provide",
      type: "number",
    })
    .positional("collateral-amount", {
      describe: "The amount of collateral to provide to the borrow position",
      type: "number",
    })
    .positional("borrow-amount", {
      describe: "The amount of onAsset you wish to mint",
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
    const pool = tokenData.pools[yargs.poolIndex];
    const collateral = tokenData.collaterals[yargs.collateralIndex];

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      pool.assetInfo.onassetMint
    );
    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      collateral.mint
    );

    const borrowAmount = new BN(`${toDevnetScale(yargs.borrowAmount)}`);
    const collateralAmount = new BN(
      `${toScale(
        yargs.collateralAmount,
        Number(toDecimal(collateral.vaultMintSupply).scale())
      )}`
    );

    let updatePricesIx = await cloneClient.updatePricesInstruction();

    let ix = await cloneClient.initializeBorrowPositionInstruction(
      collateralTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      borrowAmount,
      collateralAmount,
      yargs.poolIndex,
      yargs.collateralIndex
    );
    await setup.provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    successLog(
      `Borrowed Initialized:\nPool Index: ${yargs.poolIndex}\nCollateral Index: ${yargs.collateralIndex}\nCollateral Amount: ${yargs.collateralAmount}\nBorrowed Amount: ${yargs.borrowAmount}`
    );
  } catch (error: any) {
    errorLog(`Failed to initialize borrow:\n${error.message}`);
  }
};
