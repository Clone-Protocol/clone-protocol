import * as anchor from "@coral-xyz/anchor";
import { CloneClient } from "../../sdk/src/clone";
import { Transaction } from "@solana/web3.js";
import { successLog, errorLog, anchorSetup, getCloneProgram } from "../utils";

exports.command = "init";
exports.desc = "Initializes your user account, necessary to provide liquidity";
exports.builder = () => {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);

    let tx = new Transaction();
    tx.add(await cloneClient.initializeUserInstruction());

    const borrowAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await cloneClient.initializeBorrowPositionsAccountInstruction(
        borrowAccountKeypair
      )
    );

    const cometAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await cloneClient.initializeCometInstruction(cometAccountKeypair, false)
    );

    const singlePoolCometAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await cloneClient.initializeCometInstruction(
        singlePoolCometAccountKeypair,
        true
      )
    );

    await cloneClient.provider.sendAndConfirm!(tx, [
      borrowAccountKeypair,
      cometAccountKeypair,
      singlePoolCometAccountKeypair,
    ]);

    successLog("User Account Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize User Account:\n${error.message}`);
  }
};
