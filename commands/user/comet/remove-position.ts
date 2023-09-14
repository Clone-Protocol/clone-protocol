import { Transaction } from "@solana/web3.js";
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
}

exports.command = "remove-position <comet-position-index>";
exports.desc = "Remove a comet liquidity position";
exports.builder = (yargs: CommandArguments) => {
  yargs.positional("comet-position-index", {
    describe: "The index of the comet position you are removing",
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

    let ix = cloneClient.removeCometPositionInstruction(
      yargs.cometPositionIndex
    );

    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`Position ${yargs.cometPositionIndex} Removed!`);
  } catch (error: any) {
    errorLog(`Failed to remove position:\n${error.message}`);
  }
};
