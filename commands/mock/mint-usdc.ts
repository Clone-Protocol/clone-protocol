import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterProgram,
  getCloneProgram,
  getUSDC,
  getOrCreateAssociatedTokenAccount,
} from "../utils";
import { CloneClient, toScale } from "../../sdk/src/clone";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  amount: number;
}

exports.command = "mint-usdc <amount>";
exports.desc = "Mints mock USDC into user's wallet";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("amount", {
    describe: "The amount of mock USDC to mint",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    if (setup.network != "localnet") {
      throw Error("Mock instruction must be run on localnet");
    }

    const jupiterProgram = getMockJupiterProgram(setup.provider);
    let [jupiterAddress, jupiterNonce] = await PublicKey.findProgramAddress(
      [anchor.utils.bytes.utf8.encode("jupiter")],
      jupiterProgram.programId
    );

    const cloneProgram = getCloneProgram(setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);

    const usdcMint = await getUSDC();

    const usdcMintAmount = new BN(`${toScale(yargs.amount, 7)}`);
    const mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      usdcMint
    );
    await jupiterProgram.methods
      .mintUsdc(jupiterNonce, usdcMintAmount)
      .accounts({
        usdcMint: usdcMint,
        usdcTokenAccount: mockUSDCTokenAccountInfo.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    successLog(`${yargs.amount} Mock USDC Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint mock USDC:\n${error.message}`);
  }
};
