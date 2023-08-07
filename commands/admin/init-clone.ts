import * as anchor from "@coral-xyz/anchor";
import { Transaction, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getUSDC,
  getCloneClient,
} from "../utils";
import { Argv } from "yargs";
import { CloneClient, CLONE_TOKEN_SCALE } from "../../sdk/src/clone";

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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const usdc = getUSDC();

    const treasuryAddress = anchor.web3.Keypair.generate();
    const onusdMint = anchor.web3.Keypair.generate();

    let tx = new Transaction().add(
      // create onusd mint account
      SystemProgram.createAccount({
        fromPubkey: provider.publicKey,
        newAccountPubkey: onusdMint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
        programId: TOKEN_PROGRAM_ID,
      }),
      // init clone mint account
      createInitializeMintInstruction(
        onusdMint.publicKey,
        CLONE_TOKEN_SCALE,
        cloneAccountAddress,
        null
      )
    );
    await provider.sendAndConfirm(tx, [onusdMint]);

    await CloneClient.initializeClone(
      provider,
      cloneProgramID,
      yargs.cometLiquidatorFee,
      yargs.borrowLiquidatorFee,
      treasuryAddress.publicKey,
      usdc,
      onusdMint.publicKey
    );

    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await provider.sendAndConfirm!(
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey!,
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
