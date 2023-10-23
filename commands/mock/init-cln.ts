import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { successLog, errorLog, anchorSetup, createTokenMint } from "../utils";
import { CLONE_TOKEN_SCALE } from "../../sdk/src/clone";

exports.command = "init-cln";
exports.desc = "Initializes Mock $CLN";
exports.builder = () => {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();

    const clnMintKeyPair = anchor.web3.Keypair.generate();

    await createTokenMint(provider, {
      mint: clnMintKeyPair,
      scale: CLONE_TOKEN_SCALE,
      authority: provider.publicKey,
    });

    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.cln = clnMintKeyPair.publicKey.toString();

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog("Mock $CLN Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Mock $CLN:\n${error.message}`);
  }
};
