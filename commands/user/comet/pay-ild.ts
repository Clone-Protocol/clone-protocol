import { Transaction } from "@solana/web3.js";
import { toCloneScale } from "../../../sdk/src/clone";
import { getILD } from "../../../sdk/src/healthscore";
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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const tokenData = await cloneClient.getTokenData();
    const user = await cloneClient.getUserAccount();
    const comet = user.comet;
    const pool =
      tokenData.pools[
        Number(comet.positions[yargs.cometPositionIndex].poolIndex)
      ];

    let ildInfo = getILD(tokenData, comet)[yargs.cometPositionIndex];

    const onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      cloneClient.clone!.onusdMint
    );

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
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

    let ix = cloneClient.payCometILDInstruction(
      tokenData,
      user,
      yargs.cometPositionIndex,
      toCloneScale(amount),
      yargs.payOnusdDebt,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    if (yargs.payOnusdDebt) {
      successLog(`${yargs.amount} onUSD Debt Payed!`);
    } else {
      successLog(`${yargs.amount} onAsset Debt Payed!`);
    }
  } catch (error: any) {
    errorLog(`Failed to pay ILD:\n${error.message}`);
  }
};
