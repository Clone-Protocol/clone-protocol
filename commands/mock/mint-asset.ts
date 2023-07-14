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
  getOrCreateAssociatedTokenAccount,
  getMockAssetMint,
} from "../utils";
import { CloneClient, toDevnetScale } from "../../sdk/src/clone";
import { Argv } from "yargs";

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
    const setup = anchorSetup();

    const jupiterProgram = getMockJupiterProgram(setup.provider);
    let [jupiterAddress, jupiterNonce] = await PublicKey.findProgramAddress(
      [anchor.utils.bytes.utf8.encode("jupiter")],
      jupiterProgram.programId
    );

    const cloneProgram = getCloneProgram(setup.provider);

    const cloneClient = new CloneClient(cloneProgram.programId, setup.provider);

    const mockAssetMint = await getMockAssetMint(setup.provider, yargs.index);

    const mockAssetMintAmount = new BN(`${toDevnetScale(yargs.amount)}`);
    const mockAssetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockAssetMint
    );

    await jupiterProgram.methods
      .mintAsset(jupiterNonce, yargs.index, mockAssetMintAmount)
      .accounts({
        assetMint: mockAssetMint,
        assetTokenAccount: mockAssetTokenAccountInfo.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    successLog(`${yargs.amount} Mock Asset ${yargs.index} Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint mock asset:\n${error.message}`);
  }
};
