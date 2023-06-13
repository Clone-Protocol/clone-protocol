import { CloneClient, toDevnetScale } from "../../../sdk/src/clone";
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
exports.desc = "Initializes your user account, necessary to provide liquidity";
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
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[yargs.poolIndex];
    const collateral = tokenData.collaterals[yargs.collateralIndex];;

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      collateral.mint
    );

    const borrowAmount = new BN(`${toDevnetScale(yargs.borrowAmount)}`);
    const collateralAmount = new BN(`${toDevnetScale(yargs.collateralAmount)}`);

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await cloneClient.initializeBorrowPosition(
      borrowAmount,
      collateralAmount,
      collateralTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      yargs.poolIndex,
      yargs.collateralIndex,
      signers
    );

    successLog("User Account Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize User Account:\n${error.message}`);
  }
};
