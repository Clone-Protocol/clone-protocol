import { Transaction } from "@solana/web3.js";
import { CloneClient, toDevnetScale } from "../../../sdk/src/clone";
import { getILD } from "../../../sdk/src/healthscore";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getOrCreateAssociatedTokenAccount,
} from "../../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  cometPositionIndex: number;
  payOnusdDebt: boolean;
  amount: number;
}

exports.command = "pay-ild <comet-position-index> [pay-onusd-debt] [amount]";
exports.desc = "Pay impermanent loss debt to protect your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("comet-position-index", {
      describe: "The index of the comet position you are paying debt for",
      type: "number",
    })
    .positional("pay-onusd-debt", {
      describe:
        "True if you are paying onUSD debt, false if paying onAsset debt",
      type: "boolean",
      default: true,
    })
    .positional("amount", {
      describe: "The amount of impermanent loss you would like to pay",
      type: "number",
      default: -1,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();

    const comet = await cloneClient.getComet();
    const pool =
      tokenData.pools[comet.positions[yargs.cometPositionIndex].poolIndex];

    let ildInfo = getILD(tokenData, comet)[yargs.cometPositionIndex];

    const onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      cloneClient.clone!.onusdMint
    );

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      pool.assetInfo.onassetMint
    );

    let amount: number;
    if (
      yargs.payOnusdDebt &&
      (yargs.amount < 0 || yargs.amount > ildInfo.onusdILD)
    ) {
      amount = ildInfo.onusdILD;
    } else if (yargs.amount < 0 || yargs.amount > ildInfo.onAssetILD) {
      amount = ildInfo.onAssetILD;
    } else {
      amount = yargs.amount;
    }

    let ix = await cloneClient.payCometILDInstruction(
      yargs.cometPositionIndex,
      toDevnetScale(amount),
      yargs.payOnusdDebt,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address
    );
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    if (yargs.payOnusdDebt) {
      successLog(`${yargs.amount} onUSD Debt Payed!`);
    } else {
      successLog(`${yargs.amount} onAsset Debt Payed!`);
    }
  } catch (error: any) {
    errorLog(`Failed to pay ILD:\n${error.message}`);
  }
};
