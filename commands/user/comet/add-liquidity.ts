import { Transaction } from "@solana/web3.js";
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
  amount: number;
}

exports.command = "add-liquidity <pool-index> <amount>";
exports.desc = "Adds liquidity to your comet";
exports.builder = (yargs: CommandArguments) => {
  yargs
    .positional("pool-index", {
      describe: "The index of the pool you are providing to",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of onUSD liquidity to provide to the pool",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    let updatePricesIx = await cloneClient.updatePricesInstruction()
    ;
    const amount = new BN(`${toDevnetScale(yargs.amount)}`);

    let ix = await cloneClient.addLiquidityToCometInstruction(
        amount,
        yargs.poolIndex
      );
      await setup.provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(ix)
      );

    successLog(`${yargs.amount} onUSD Liquidity Added!`);
  } catch (error: any) {
    errorLog(`Failed to add liquidity to comet position:\n${error.message}`);
  }
};
