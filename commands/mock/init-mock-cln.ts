import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Transaction, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import { successLog, errorLog, anchorSetup } from "../utils";
import { CLONE_TOKEN_SCALE } from "../../sdk/src/clone";

exports.command = "init-mock-cln";
exports.desc = "Initializes Mock $CLN";
exports.builder = () => {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();

    const clnMintKeyPair = anchor.web3.Keypair.generate();

    let tx = new Transaction().add(
      // create cln mint account
      SystemProgram.createAccount({
        fromPubkey: provider.publicKey,
        newAccountPubkey: clnMintKeyPair.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
        programId: TOKEN_PROGRAM_ID,
      }),
      // init clone mint account
      createInitializeMintInstruction(
        clnMintKeyPair.publicKey,
        CLONE_TOKEN_SCALE,
        provider.publicKey,
        null
      )
    );
    await provider.sendAndConfirm(tx, [clnMintKeyPair]);

    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.cln = clnMintKeyPair.publicKey.toString();

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog("Mock $CLN Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Mock $CLN:\n${error.message}`);
  }
};
