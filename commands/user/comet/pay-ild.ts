import { Transaction } from "@solana/web3.js";
import { toCloneScale } from "../../../sdk/src/clone";
import { PaymentType } from "../../../sdk/generated/clone";
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
  paymentType: number;
  amount: number;
}

exports.command = "pay-ild <comet-position-index> [amount] [payment-type]";
exports.desc = "Pay impermanent loss debt to protect your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("comet-position-index", {
      describe: "The index of the comet position you are paying debt for",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of impermanent loss you would like to pay",
      type: "number",
    })
    .positional("payment-type", {
      describe:
        "0 if paying with onAsset, 1 if paying debt with collateral from comet, 2 if paying with collateral from wallet",
      type: "number",
      default: 0,
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
    const collateral = cloneClient.clone.collateral;
    const user = await cloneClient.getUserAccount();
    const comet = user.comet;
    const pool =
      pools.pools[Number(comet.positions[yargs.cometPositionIndex].poolIndex)];

    let ildInfo = getILD(collateral, pools, oracles, comet)[
      yargs.cometPositionIndex
    ];

    const collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      collateral.mint
    );

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      pool.assetInfo.onassetMint
    );

    let amount: number;
    if (
      yargs.paymentType > PaymentType.Onasset &&
      (yargs.amount < 0 || yargs.amount > ildInfo.collateralILD)
    ) {
      amount = ildInfo.collateralILD;
    } else if (yargs.amount < 0 || yargs.amount > ildInfo.onAssetILD) {
      amount = ildInfo.onAssetILD;
    } else {
      amount = yargs.amount;
    }

    let ix = cloneClient.payCometILDInstruction(
      pools,
      user,
      yargs.cometPositionIndex,
      toCloneScale(amount),
      yargs.paymentType,
      onassetTokenAccountInfo.address,
      collateralTokenAccountInfo.address
    );
    await provider.sendAndConfirm(new Transaction().add(ix));

    if (yargs.paymentType > PaymentType.Onasset) {
      successLog(`${yargs.amount} collateral Debt Payed!`);
    } else {
      successLog(`${yargs.amount} onAsset Debt Payed!`);
    }
  } catch (error: any) {
    errorLog(`Failed to pay ILD:\n${error.message}`);
  }
};
