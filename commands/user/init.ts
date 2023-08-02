import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../utils";

exports.command = "init";
exports.desc = "Initializes your user account, necessary to provide liquidity";
exports.builder = () => {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(cloneClient.initializeUserInstruction())
    );

    successLog("User Account Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize User Account:\n${error.message}`);
  }
};
