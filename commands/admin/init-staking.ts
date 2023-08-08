import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Transaction, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
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
  getCloneStakingData,
  getCLN,
} from "../utils";
import { Argv } from "yargs";
import { CLONE_TOKEN_SCALE } from "../../sdk/src/clone";
import * as CloneStaking from "../../sdk/generated/clone-staking";

interface CommandArguments extends Argv {
  stakingPeriodSlots: number;
}

exports.command = "init-staking [staking-period-slots]";
exports.desc = "Initializes the Clone Staking program";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("staking-period-slots", {
    describe: "The number of staking period slots that a deposit is locked for",
    type: "number",
    default: 24,
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [__, cloneStakingAddress] = getCloneStakingData();

    const clnTokenMint = getCLN();
    // if (yargs.clnMint != "") {
    //   clnMintPubkey = new PublicKey(yargs.clnMint);
    // } else {
    //   const clnMintKeyPair = anchor.web3.Keypair.generate();

    //   let tx = new Transaction().add(
    //     // create cln mint account
    //     SystemProgram.createAccount({
    //       fromPubkey: provider.publicKey,
    //       newAccountPubkey: clnMintKeyPair.publicKey,
    //       space: MINT_SIZE,
    //       lamports: await getMinimumBalanceForRentExemptMint(
    //         provider.connection
    //       ),
    //       programId: TOKEN_PROGRAM_ID,
    //     }),
    //     // init clone mint account
    //     createInitializeMintInstruction(
    //       clnMintKeyPair.publicKey,
    //       CLONE_TOKEN_SCALE,
    //       provider.publicKey,
    //       null
    //     )
    //   );
    //   await provider.sendAndConfirm(tx, [clnMintKeyPair]);

    //   clnMintPubkey = clnMintKeyPair.publicKey;
    // }

    const clnTokenVault = await getAssociatedTokenAddress(
      clnTokenMint,
      cloneStakingAddress,
      true
    );

    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        provider.publicKey!,
        clnTokenVault,
        cloneStakingAddress,
        clnTokenMint
      ),
      CloneStaking.createInitializeInstruction(
        {
          admin: provider.publicKey!,
          cloneStaking: cloneStakingAddress,
          clnTokenMint: clnTokenMint,
          clnTokenVault: clnTokenVault,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        {
          stakingPeriodSlots: new BN(yargs.stakingPeriodSlots),
        }
      )
    );

    await provider.sendAndConfirm!(tx);

    successLog("Clone Staking Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Clone Staking Program:\n${error.message}`);
  }
};
