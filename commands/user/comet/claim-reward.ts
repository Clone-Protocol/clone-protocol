import { Transaction } from "@solana/web3.js";
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

    const onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      cloneClient.clone!.onusdMint
    );

    const onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      pool.assetInfo.onassetMint
    );

    let ix = cloneClient.collectLpRewardsInstruction(
      tokenData,
      user,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      yargs.cometPositionIndex
    );

    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`Reward Claimed!`);
  } catch (error: any) {
    errorLog(`Failed to pay ILD:\n${error.message}`);
  }
};
