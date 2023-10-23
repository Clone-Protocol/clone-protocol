import { Transaction } from "@solana/web3.js";
import { CloneClient, toCloneScale, toScale } from "../../../sdk/src/clone";
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
    const amount = new BN(
      `${toScale(yargs.amount, cloneClient.clone.collateral.scale)}`
    );

    let ix = cloneClient.addLiquidityToCometInstruction(
      amount,
      yargs.poolIndex
    );
    await provider.sendAndConfirm(
      new Transaction().add(updatePricesIx).add(ix)
    );

    successLog(`${yargs.amount} USD Liquidity Added!`);
  } catch (error: any) {
    errorLog(`Failed to add liquidity to comet position:\n${error.message}`);
  }
};
