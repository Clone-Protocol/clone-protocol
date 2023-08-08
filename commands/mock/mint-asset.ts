import { BN } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterData,
  getOrCreateAssociatedTokenAccount,
  getJupiterAccount,
} from "../utils";
import { toCloneScale } from "../../sdk/src/clone";
import { Argv } from "yargs";
import { createMintAssetInstruction } from "../../sdk/generated/jupiter-agg-mock";

interface CommandArguments extends Argv {
  index: number;
  amount: number;
}

exports.command = "mint-asset <index> <amount>";
exports.desc = "Mints mock asset into user's wallet";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .positional("index", {
      describe: "The index of the asset in the Mock Jupiter Program",
      type: "number",
    })
    .positional("amount", {
      describe: "The amount of mock USDC to mint",
      type: "number",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [__, jupiterAddress] = getMockJupiterData();
    const jupiter = await getJupiterAccount(provider, jupiterAddress);
    const mockAssetMint = jupiter.assetMints[yargs.index];

    const mockAssetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      mockAssetMint
    );

    const assetIndex = yargs.index;
    const amount = new BN(`${toCloneScale(yargs.amount)}`);

    const ix = createMintAssetInstruction(
      {
        assetMint: mockAssetMint,
        assetTokenAccount: mockAssetTokenAccountInfo.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { assetIndex, amount }
    );

    await provider.sendAndConfirm(new Transaction().add(ix));

    successLog(`${yargs.amount} Mock Asset ${yargs.index} Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint mock asset:\n${error.message}`);
  }
};
