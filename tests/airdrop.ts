// This test simulates the process of airdropping CLN tokens by creating staking accounts and depositing CLN.
// It attempts to replicate by setting up a squads account, creating squads transactions and approving/executing them.
// Make sure to have the `SOLANA_ENDPOINT_URL` and `BPF_OUT_DIR` environment variables set.
import { before } from "mocha";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  AddressLookupTableProgram,
  AddressLookupTableAccount,
  AddressLookupTableState,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ProgramTestContext,
  AddedAccount,
  startAnchor,
  AccountInfoBytes,
} from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import * as Squads from "@sqds/multisig";
import { Receiver, runAirdrop } from "../scripts/airdrop";
import {
  PROGRAM_ID as CloneStakingProgramId,
  createInitializeInstruction,
  User as ClnStakingUser,
} from "../sdk/generated/clone-staking";
import { assert } from "chai";

export const pullAccounts = async (
  pubkeys: PublicKey[],
  connection: Connection
): Promise<AddedAccount[]> => {
  const batchSize = 100;
  let result: AddedAccount[] = [];

  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    const req = await connection.getMultipleAccountsInfo(batch, "confirmed");
    req.forEach((info, index) => {
      if (!info) return;
      result.push({
        address: pubkeys[i + index],
        info,
      });
    });
  }

  return result;
};

describe("airdrop simulation", async () => {
  let context: ProgramTestContext;
  let connection: Connection;

  // Multisig
  const multisigPda = new PublicKey(
    process.env.SQUADS_MULTISIG_PDA ??
      "EaDEt5B3pvQuC7WotWBevJNzuz9KzYipLFGTsUV8qCP9"
  );
  const multisigVault = new PublicKey(
    process.env.VAULT_ADDRESS ?? "GPJyF8fTgKKPykRW1XSrXiEXdJTJLHnhUqdDyyek66Z"
  );
  const extraMultisigMember = Keypair.generate();
  let startingTransactionIndex: number;

  // CLN token
  const clnTokenMintKp = Keypair.generate();
  const clnDecimal = 8;

  // Airdrop receivers
  const numReceivers = 100;
  const dropValues = [100, 1000, 5000];
  const airdropReceivers: Receiver[] = [...Array(numReceivers)].map((_) => {
    const randomIndex = Math.floor(Math.random() * dropValues.length);
    return {
      address: Keypair.generate().publicKey,
      amount: Math.floor(dropValues[randomIndex] * Math.pow(10, clnDecimal)),
    };
  });
  // const airdropReceivers: Receiver[] = [{ address: Keypair.generate().publicKey, amount: 100_00000000}]

  // Nonce account keypair
  const nonceAccountAddressKp = Keypair.generate();
  let addressLookupTableAccount: AddressLookupTableAccount;

  before("setup", async function () {
    connection = new Connection(process.env.SOLANA_ENDPOINT_URL!, "confirmed");
    const accounts = await pullAccounts(
      [
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        "Fy3YMJCvwbAXUgUM5b91ucUVA3jYzwWLHL3MwBqKsh8n",
        multisigVault,
      ].map((x) => {
        return new PublicKey(x);
      }),
      connection
    );
    // Setup bankrun
    context = await startAnchor(".", [], accounts);

    // Pull squads multisig account and add payer as a member.
    let multisigRaw = (await connection.getAccountInfo(multisigPda))!;
    let multisigAccount =
      Squads.accounts.Multisig.fromAccountInfo(multisigRaw)[0];
    startingTransactionIndex = Number(multisigAccount.transactionIndex);
    multisigAccount.members.push(
      ...[
        {
          key: context.payer.publicKey,
          permissions: { mask: 7 },
        },
        { key: extraMultisigMember.publicKey, permissions: { mask: 7 } },
      ]
    );
    multisigAccount.members.sort((a, b) => {
      return a.key < b.key ? -1 : 1;
    });

    context.setAccount(multisigPda, {
      ...multisigRaw,
      data: multisigAccount.serialize()[0],
    } as AccountInfoBytes);

    // Create Setup Transaction
    let tx = new Transaction();

    // Create Nonce Address.
    let createNonceAccountIx = SystemProgram.createNonceAccount({
      fromPubkey: context.payer.publicKey,
      noncePubkey: nonceAccountAddressKp.publicKey,
      authorizedPubkey: context.payer.publicKey,
      lamports: LAMPORTS_PER_SOL,
    });
    tx.add(createNonceAccountIx);

    // Create CLN Mint
    let createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: context.payer.publicKey,
      newAccountPubkey: clnTokenMintKp.publicKey,
      space: MINT_SIZE,
      lamports: LAMPORTS_PER_SOL,
      programId: TOKEN_PROGRAM_ID,
    });
    let createMintIx = createInitializeMintInstruction(
      clnTokenMintKp.publicKey,
      clnDecimal,
      context.payer.publicKey,
      null
    );
    tx.add(createMintAccountIx, createMintIx);

    // Create Multisig CLN vault (its the CLN distributor) and
    // mint enough CLN for airdrops to the vault
    const vaultAta = getAssociatedTokenAddressSync(
      clnTokenMintKp.publicKey,
      multisigVault,
      true
    );
    const createVaultClnAtaIx = createAssociatedTokenAccountInstruction(
      context.payer.publicKey,
      vaultAta,
      multisigVault,
      clnTokenMintKp.publicKey
    );
    let mintAmount = 0;
    airdropReceivers.forEach((r) => {
      mintAmount += r.amount;
    });
    const mintClntoVaulIx = createMintToInstruction(
      clnTokenMintKp.publicKey,
      vaultAta,
      context.payer.publicKey,
      mintAmount
    );
    tx.add(createVaultClnAtaIx, mintClntoVaulIx);

    // Clone staking vault and initialize the staking program.
    const cloneStakingAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("clone-staking")],
      CloneStakingProgramId
    )[0];
    const clnStakingVault = getAssociatedTokenAddressSync(
      clnTokenMintKp.publicKey,
      cloneStakingAddress,
      true
    );
    const createClnStakingVaultIx = createAssociatedTokenAccountInstruction(
      context.payer.publicKey,
      clnStakingVault,
      cloneStakingAddress,
      clnTokenMintKp.publicKey
    );
    const initializeClnStakingIx = createInitializeInstruction(
      {
        admin: context.payer.publicKey,
        cloneStaking: cloneStakingAddress,
        clnTokenMint: clnTokenMintKp.publicKey,
        clnTokenVault: clnStakingVault,
      },
      { stakingPeriodSlots: 100 }
    );
    tx.add(createClnStakingVaultIx, initializeClnStakingIx);

    // Execute setup tx
    let blockhash = (await context.banksClient.getLatestBlockhash(
      "finalized"
    ))![0];
    tx.recentBlockhash = blockhash;
    tx.sign(context.payer);
    tx.partialSign(clnTokenMintKp);
    tx.partialSign(nonceAccountAddressKp);

    await context.banksClient.processTransaction(tx);

    let slot = await context.banksClient.getSlot("finalized");
    // Setup lookup table
    let [lookupTableInstIx, lookupTableAddress] =
      AddressLookupTableProgram.createLookupTable({
        authority: context.payer.publicKey,
        payer: context.payer.publicKey,
        recentSlot: slot - BigInt(1),
      });

    tx = new Transaction().add(
      lookupTableInstIx,
      AddressLookupTableProgram.extendLookupTable({
        payer: context.payer.publicKey,
        authority: context.payer.publicKey,
        lookupTable: lookupTableAddress,
        addresses: [
          context.payer.publicKey,
          multisigPda,
          multisigVault,
          clnTokenMintKp.publicKey,
          vaultAta,
          cloneStakingAddress,
          CloneStakingProgramId,
          clnStakingVault,
          nonceAccountAddressKp.publicKey,
        ],
      })
    );

    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash(
      "finalized"
    ))![0];
    tx.sign(context.payer);

    await context.banksClient.processTransaction(tx);

    addressLookupTableAccount = new AddressLookupTableAccount({
      key: lookupTableAddress,
      state: AddressLookupTableAccount.deserialize(
        (await context.banksClient.getAccount(lookupTableAddress))!.data
      ),
    });
    console.log(addressLookupTableAccount);
    context.warpToSlot(slot + BigInt(1));
  });

  it("run airdrop", async function () {
    // Run the airdrop script
    const provider = new BankrunProvider(context);
    await runAirdrop({
      provider,
      wallet: provider.wallet,
      batchSize: 4,
      squadsMultisigPda: multisigPda,
      receivers: airdropReceivers,
      cloneStakingProgramId: CloneStakingProgramId,
      clnTokenMint: clnTokenMintKp.publicKey,
      nonceAccountAddress: nonceAccountAddressKp.publicKey,
      vault: multisigVault,
      //lookupTableAccount: addressLookupTableAccount, // NOTE: Not really worth it, 4 -> 6.
      priorityFeeMicroLamports: 200,
      banksClient: context.banksClient,
    });
  });

  it("execute multisig transactions", async function () {
    const provider = new BankrunProvider(context);

    const multisigAccount = await Squads.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda
    );

    for (
      let idx = startingTransactionIndex + 1;
      idx <= Number(multisigAccount.transactionIndex);
      idx++
    ) {
      const transactionIndex = BigInt(idx);
      let blockhash = (await context.banksClient.getLatestBlockhash(
        "finalized"
      ))![0];
      let firstApprovalIx = Squads.instructions.proposalApprove({
        multisigPda,
        transactionIndex,
        member: context.payer.publicKey,
      });
      let secondApprovalIx = Squads.instructions.proposalApprove({
        multisigPda,
        transactionIndex,
        member: extraMultisigMember.publicKey,
      });
      let executeIx = await Squads.instructions.vaultTransactionExecute({
        connection: provider.connection,
        multisigPda,
        transactionIndex,
        member: context.payer.publicKey,
      });

      let tx = new Transaction().add(
        firstApprovalIx,
        secondApprovalIx,
        executeIx.instruction
      );
      tx.recentBlockhash = blockhash;
      tx.sign(context.payer);
      tx.partialSign(extraMultisigMember);
      await context.banksClient.processTransaction(tx);
    }
  });

  it("verify stake accounts", async function () {
    const provider = new BankrunProvider(context);

    for (let receiver of airdropReceivers) {
      const userAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), receiver.address.toBuffer()],
        CloneStakingProgramId
      )[0];
      const userAccount = await ClnStakingUser.fromAccountAddress(
        provider.connection,
        userAccountAddress
      );
      assert.equal(
        userAccount.stakedTokens.toString(),
        receiver.amount.toString()
      );
    }
  });
});
