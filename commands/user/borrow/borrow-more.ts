import { Transaction } from "@solana/web3.js";
import { toCloneScale } from "../../../sdk/src/clone";
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
import { oracleInfoBeet } from "../../../sdk/generated/clone/types/OracleInfo";

interface CommandArguments extends Argv {
  borrowIndex: number;
  amount: number;
}

exports.command = "borrow-more <borrow-index> <amount>";
exports.desc = "Adds onAsset debt to your borrow position";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("borrow-index", {
      describe: "The index of the borrow position",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of additional onAsset to borrow",
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
    const user = await cloneClient.getUserAccount();
    const borrowPosition = user.borrows[yargs.borrowIndex];

    const pool = pools.pools[Number(borrowPosition.poolIndex)];

    const onAssetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      pool.assetInfo.onassetMint
    );

    let upgradePricesIx = cloneClient.updatePricesInstruction(oracles);

    const amount = new BN(`${toCloneScale(yargs.amount)}`);

    let ix = cloneClient.borrowMoreInstruction(
      pools,
      user,
      onAssetTokenAccountInfo.address,
      amount,
      yargs.borrowIndex
    );
    await provider.sendAndConfirm(
      new Transaction().add(upgradePricesIx).add(ix)
    );

    successLog(`${yargs.amount} onAsset Borrowed!`);
  } catch (error: any) {
    errorLog(`Failed to borrow additional onAsset:\n${error.message}`);
  }
};
