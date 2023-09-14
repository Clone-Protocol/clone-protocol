import { Transaction } from "@solana/web3.js";
import { toCloneScale } from "../../../sdk/src/clone";
import { BN } from "@coral-xyz/anchor";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  cometPositionIndex: number;
  amount: number;
}

exports.command = "withdraw-liquidity <comet-position-index> <amount>";
exports.desc = "Withdraws liquidity from your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("comet-position-index", {
      describe: "The index of the comet position you are withdrawing from",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of collateral liquidity to provide to the pool",
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

    const oracles = await cloneClient.getOracles();

    let updatePricesIx = cloneClient.updatePricesInstruction(oracles);
    const amount = new BN(`${toCloneScale(yargs.amount)}`);

    let ix = cloneClient.withdrawLiquidityFromCometInstruction(
      amount,
      yargs.cometPositionIndex
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    successLog(`${yargs.amount} onUSD Liquidity Withdrawn!`);
  } catch (error: any) {
    errorLog(
      `Failed to withdraw liquidity from comet position:\n${error.message}`
    );
  }
};
