import { Transaction } from "@solana/web3.js";
import { CloneClient } from "../../sdk/src/clone";
import { successLog, errorLog, anchorSetup, getCloneProgram } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  indices: number[];
}

exports.command = "update-prices [indices..]";

exports.desc = "Updates onAsset oracle prices on Clone";
exports.builder = {
  indices: {
    type: "number",
    describe: "Indices of the pools to update",
    default: undefined,
  },
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.provider);

    let cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    let ix;
    if (yargs.indices != undefined) {
      ix = await cloneClient.updatePricesInstruction(yargs.indices);
    } else {
      ix = await cloneClient.updatePricesInstruction();
    }
    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    successLog("Prices Updated!");
  } catch (error: any) {
    errorLog(`Failed to update prices:\n${error.message}`);
  }
};
