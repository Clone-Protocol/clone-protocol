import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Transaction, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneStakingData,
  getCLN,
  getCloneStakingAccount,
  getOrCreateAssociatedTokenAccount,
} from "../../utils";
import { Argv } from "yargs";
import { CLONE_TOKEN_SCALE, toScale } from "../../../sdk/src/clone";
import * as CloneStaking from "../../../sdk/generated/clone-staking";

interface CommandArguments extends Argv {
  amount: number;
}

exports.command = "add <amount>";
exports.desc = "Stakes $CLN to user account";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("amount", {
    describe: "The amount of $CLN to stake",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [cloneStakingProgramId, cloneStakingAddress] = getCloneStakingData();

    const [userStakingAddress, __] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), provider.publicKey.toBuffer()],
      cloneStakingProgramId
    );

    const cloneStakingAccount = await getCloneStakingAccount(
      provider,
      cloneStakingAddress
    );

    const clnTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider,
      cloneStakingAccount.clnTokenMint
    );

    const amount = new BN(`${toScale(yargs.amount, CLONE_TOKEN_SCALE)}`);

    const tx = new Transaction().add(
      CloneStaking.createAddStakeInstruction(
        {
          user: provider.publicKey!,
          userAccount: userStakingAddress,
          cloneStaking: cloneStakingAddress,
          clnTokenMint: cloneStakingAccount.clnTokenMint,
          clnTokenVault: cloneStakingAccount.clnTokenVault,
          userClnTokenAccount: clnTokenAccountInfo.address,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        {
          amount: amount,
        }
      )
    );

    await provider.sendAndConfirm!(tx);

    successLog(`${yargs.amount} $CLN Staked!`);
  } catch (error: any) {
    errorLog(`Failed to stake $CLN:\n${error.message}`);
  }
};
