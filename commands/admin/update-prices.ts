import { Transaction } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../utils";
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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );
    const tokenData = await cloneClient.getTokenData();

    let ix;
    if (yargs.indices != undefined) {
      ix = cloneClient.updatePricesInstruction(tokenData, yargs.indices);
    } else {
      ix = cloneClient.updatePricesInstruction(tokenData);
    }
    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog("Prices Updated!");
  } catch (error: any) {
    errorLog(`Failed to update prices:\n${error.message}`);
  }
};
