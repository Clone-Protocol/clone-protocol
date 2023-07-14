import { Transaction } from "@solana/web3.js";
import { CloneClient } from "../../../sdk/src/clone";
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
}

exports.command = "claim-reward <comet-position-index>";
exports.desc = "Claim reward from your comet liquidity position";
exports.builder = (yargs: CommandArguments) => {
  yargs.positional("comet-position-index", {
    describe: "The index of the comet position you are paying debt for",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const tokenData = await cloneClient.getTokenData();

    const comet = await cloneClient.getComet();
    const pool =
      tokenData.pools[comet.positions[yargs.cometPositionIndex].poolIndex];

    const onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      cloneClient.clone!.onusdMint
    );

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      setup.provider,
      pool.assetInfo.onassetMint
    );

    let ix = await cloneClient.claimLpRewardsInstruction(
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      yargs.cometPositionIndex
    );

    await setup.provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`Reward Claimed!`);
  } catch (error: any) {
    errorLog(`Failed to pay ILD:\n${error.message}`);
  }
};
