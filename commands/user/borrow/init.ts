import { Transaction } from "@solana/web3.js";
import { toCloneScale, toScale } from "../../../sdk/src/clone";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
  getOrCreateAssociatedTokenAccount,
} from "../../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  poolIndex: number;
  collateralAmount: number;
  borrowAmount: number;
}

exports.command =
  "init <pool-index> <collateral-amount> <borrow-amount>";
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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const pools = await cloneClient.getPools();
    const oracles = await cloneClient.getOracles();
    const pool = pools.pools[yargs.poolIndex];
    const collateral = cloneClient.clone.collateral;

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      pool.assetInfo.onassetMint
    );
    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );

    const borrowAmount = new BN(`${toCloneScale(yargs.borrowAmount)}`);
    const collateralAmount = new BN(
      `${toScale(yargs.collateralAmount, Number(collateral.scale))}`
    );

    let updatePricesIx = cloneClient.updatePricesInstruction(oracles);

    let ix = cloneClient.initializeBorrowPositionInstruction(
      pools,
      collateralTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      borrowAmount,
      collateralAmount,
      yargs.poolIndex
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    successLog(
      `Borrowed Initialized:\nPool Index: ${yargs.poolIndex}\nCollateral Amount: ${yargs.collateralAmount}\nBorrowed Amount: ${yargs.borrowAmount}`
    );
  } catch (error: any) {
    errorLog(`Failed to initialize borrow:\n${error.message}`);
  }
};
