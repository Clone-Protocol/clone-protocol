import {
  PublicKey,
  SystemProgram,
  NonceAccount,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
  VersionedTransaction,
  VersionedMessage,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  TransactionInstruction,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as CloneStaking from "../sdk/generated/clone-staking";
import * as Squads from "@sqds/multisig";
import { BanksClient } from "solana-bankrun";

export type Receiver = { address: PublicKey; amount: number };

const createAddStakeAccountIx = (
  admin: PublicKey,
  receiver: Receiver,
  cloneStakingProgramId: PublicKey,
  startingSlot: number,
  endingSlot: number,
): TransactionInstruction => {
  const userAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), receiver.address.toBuffer()],
    cloneStakingProgramId
  )[0];

  const cloneStaking = PublicKey.findProgramAddressSync(
    [Buffer.from("clone-staking")],
    cloneStakingProgramId
  )[0];

  return CloneStaking.createUpdateUserVestingInstruction(
    {
      admin,
      userAccount,
      cloneStaking,
    },
    {
      user: receiver.address,
      vesting: {
        amountWithdrawn: 0,
        allocationAmount: receiver.amount,
        startingSlot,
        endingSlot
      } as CloneStaking.UserVestingInfo,
    },
    cloneStakingProgramId
  );
};

export type AirdropParams = {
  provider: anchor.Provider;
  wallet: anchor.Wallet;
  batchSize: number;
  receivers: Receiver[];
  squadsMultisigPda: PublicKey;
  cloneStakingProgramId: PublicKey;
  clnTokenMint: PublicKey;
  nonceAccountAddress: PublicKey;
  vault: PublicKey;
  startingSlot: number;
  endingSlot: number;
  lookupTableAccount?: AddressLookupTableAccount;
  priorityFeeMicroLamports?: number;
  banksClient?: BanksClient;
};

export const runAirdrop = async (params: AirdropParams) => {
  let provider = params.provider;
  let wallet = params.wallet;

  const cloneStakingAccountAddress = PublicKey.findProgramAddressSync(
    [Buffer.from("clone-staking")],
    params.cloneStakingProgramId
  )[0];

  let cloneStakingAccount = await CloneStaking.CloneStaking.fromAccountAddress(
    provider.connection, cloneStakingAccountAddress
  )

  for (let i = 0; i < params.receivers.length; i += params.batchSize) {
    const batch = params.receivers.slice(i, i + params.batchSize);
    const blockhash = params.banksClient
      ? (await params.banksClient.getLatestBlockhash("finalized"))![0]
      : (await provider.connection.getLatestBlockhash("finalized")).blockhash;
    // Instructions
    let transactionMessage = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: wallet.publicKey,
      instructions: batch.map((r) => {
        return createAddStakeAccountIx(
          cloneStakingAccount.admin,
          r,
          params.cloneStakingProgramId,
          params.startingSlot,
          params.endingSlot
        );
      }),
    });

    let squadsPdaAccount = await Squads.accounts.Multisig.fromAccountAddress(
      provider.connection,
      params.squadsMultisigPda
    );

    const transactionIndex = BigInt(
      Number(squadsPdaAccount.transactionIndex) + 1
    );
    // Create a squads tx
    let vaultIx = Squads.instructions.vaultTransactionCreate({
      multisigPda: params.squadsMultisigPda,
      creator: wallet.publicKey,
      transactionIndex,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage,
      addressLookupTableAccounts: params.lookupTableAccount
        ? [params.lookupTableAccount]
        : undefined,
    });

    let proposalIx = Squads.instructions.proposalCreate({
      multisigPda: params.squadsMultisigPda,
      creator: wallet.publicKey,
      transactionIndex,
    });

    // Add durable nonce
    const accountInfo = (await provider.connection.getAccountInfo(
      params.nonceAccountAddress
    ))!;
    const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
    const advNonceIx = SystemProgram.nonceAdvance({
      noncePubkey: params.nonceAccountAddress,
      authorizedPubkey: wallet.publicKey,
    });

    // Create and sign Transaction
    let instructions: TransactionInstruction[] = [
      advNonceIx,
      vaultIx,
      proposalIx,
    ];

    if (params.priorityFeeMicroLamports) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: params.priorityFeeMicroLamports,
        })
      );
    }

    let tx = new Transaction().add(...instructions);
    tx.recentBlockhash = nonceAccount.nonce;
    tx.feePayer = wallet.publicKey;

    tx = await wallet.signTransaction(tx);

    while (true) {
      if (params.banksClient) {
        let res = await params.banksClient?.processTransaction(tx);
        break;
      } else {
        let signature = await provider.connection.sendRawTransaction(
          tx.serialize()
        );
        const slot = await provider.connection.getSlot("finalized");
        let res = await provider.connection.confirmTransaction({
          signature,
          minContextSlot: slot,
          nonceAccountPubkey: params.nonceAccountAddress,
          nonceValue: nonceAccount.nonce,
        });

        if (!res.value.err) {
          break;
        } else {
          // Need to check if err is because of nonce error.
          console.log(res);
        }
      }
    }
  }
};

const main = async () => {
  const CLONE_STAKING_PROGRAM_ID = new PublicKey(
    process.env.CLONE_STAKING_PROGRAM_ID ?? CloneStaking.PROGRAM_ID
  );
  const CLN_TOKEN_MINT = new PublicKey(process.env.CLONE_TOKEN_MINT!);
  const SQUADS_MULTISIG_PDA = new PublicKey(
    process.env.SQUADS_MULTISIG_PDA ??
      "EaDEt5B3pvQuC7WotWBevJNzuz9KzYipLFGTsUV8qCP9"
  );
  const NONCE_ACCOUNT_ADDRESS = new PublicKey(
    process.env.NONCE_ACCOUNT_ADDRESS!
  );
  //const receivers: Receiver[] = JSON.parse(fs.readFileSync(process.env.AIRDROP_FILE!).toString())
};

// main().catch(console.error);
