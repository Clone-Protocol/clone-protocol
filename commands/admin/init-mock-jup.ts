import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterProgram,
} from "../utils";

exports.command = "init-mock-jup";
exports.desc = "Initializes the Mock Jupiter program";
exports.builder = {};
exports.handler = async function () {
  try {
    const setup = anchorSetup();

    const jupiterProgram = getMockJupiterProgram(setup.provider);

    let [jupiterAddress, _] = await PublicKey.findProgramAddress(
      [anchor.utils.bytes.utf8.encode("jupiter")],
      jupiterProgram.programId
    );

    const mockUSDCMint = anchor.web3.Keypair.generate();
    await jupiterProgram.methods
      .initialize()
      .accounts({
        admin: jupiterProgram.provider.publicKey!,
        jupiterAccount: jupiterAddress,
        usdcMint: mockUSDCMint.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([mockUSDCMint])
      .rpc();

    successLog("Mock Jupiter Program Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Mock Jupiter Program:\n${error.message}`);
  }
};
