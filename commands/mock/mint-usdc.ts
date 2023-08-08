import { BN } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterData,
  getUSDC,
  getOrCreateAssociatedTokenAccount,
} from "../utils";
import { toScale } from "../../sdk/src/clone";
import { Argv } from "yargs";
import { createMintUsdcInstruction } from "../../sdk/generated/jupiter-agg-mock";

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
    const provider = anchorSetup();
    const [__, jupiterAddress] = getMockJupiterData();

    const usdcMint = await getUSDC();

    const amount = new BN(`${toScale(yargs.amount, 7)}`);
    const mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      usdcMint
    );
    
    const ix = createMintUsdcInstruction(
      {
        usdcMint: usdcMint,
        usdcTokenAccount: mockUSDCTokenAccountInfo.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { amount }
    );

    await provider.sendAndConfirm(new Transaction().add(ix));
    successLog(`${yargs.amount} Mock USDC Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint mock USDC:\n${error.message}`);
  }
};
