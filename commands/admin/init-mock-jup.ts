import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterData,
} from "../utils";
import { createInitializeInstruction } from "../../sdk/generated/jupiter-agg-mock";

exports.command = "init-mock-jup";
exports.desc = "Initializes the Mock Jupiter program";
exports.builder = {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();

    const [__, jupiterAddress] = getMockJupiterData();

    const mockUSDCMint = anchor.web3.Keypair.generate();

    let ix = createInitializeInstruction({
      admin: provider.publicKey!,
      jupiterAccount: jupiterAddress,
      usdcMint: mockUSDCMint.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    });

    await provider.sendAndConfirm(new Transaction().add(ix), [mockUSDCMint]);

    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.usdc = mockUSDCMint.publicKey.toString();

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog("Mock Jupiter Program Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Mock Jupiter Program:\n${error.message}`);
  }
};
