import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { CloneClient } from "../../sdk/src/clone";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getUSDC,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  cometLiquidatorFee: number;
  borrowLiquidatorFee: number;
}

exports.command = "init-clone";
exports.desc = "Initializes the Clone program with optional parameters";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("comet-liquidator-fee", {
      describe: "The fee percentage a liquidator recieves for comet positions",
      type: "number",
      default: 500,
    })
    .option("borrow-liquidator-fee", {
      describe: "The fee percentage a liquidator recieves for borrow positions",
      type: "number",
      default: 500,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.provider);
    const usdc = await getUSDC();

    let cloneClient = new CloneClient(cloneProgram.programId, setup.provider);

    const treasuryAddress = anchor.web3.Keypair.generate();

    await cloneClient.initializeClone(
      yargs.cometLiquidatorFee,
      yargs.borrowLiquidatorFee,
      treasuryAddress.publicKey,
      usdc
    );

    await cloneClient.loadClone();

    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(
        await createAssociatedTokenAccountInstruction(
          cloneClient.provider.publicKey!,
          treasuryOnusdAssociatedTokenAddress,
          treasuryAddress.publicKey,
          cloneClient.clone!.onusdMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    );

    successLog("Clone Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Clone Program:\n${error.message}`);
  }
};
