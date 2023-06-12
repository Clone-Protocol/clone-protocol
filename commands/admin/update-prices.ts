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
    type: 'number',
    describe: 'Indices of the pools to update',
    default: undefined
  }
};
exports.handler = async function (argv: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    let cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    // @ts-ignore
    let signers: Array<Signer> = [setup.provider.wallet.payer];
    await cloneClient.updatePrices(argv.indices, signers);

    successLog("Prices Updated!");
  } catch (error: any) {
    errorLog(`Failed to update prices:\n${error.message}`);
  }
};

