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
  createAssociatedTokenAccountIdempotentInstruction,
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
import { AirdropParams, Receiver, runAirdrop } from "../scripts/airdrop";
import {
  PROGRAM_ID as CloneStakingProgramId,
  createInitializeInstruction,
  createInitializeUserInstruction,
  User as ClnStakingUser,
  CloneStaking,
  createWithdrawVestedStakeInstruction,
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
  let provider: BankrunProvider;
  let airdropParams: AirdropParams;
  const solanaRpcUrl =
    process.env.SOLANA_ENDPOINT_URL ?? "https://api.mainnet-beta.solana.com";

  const cloneStakingAddress = PublicKey.findProgramAddressSync(
    [Buffer.from("clone-staking")],
    CloneStakingProgramId
  )[0];

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
  const clnStakingVault = getAssociatedTokenAddressSync(
    clnTokenMintKp.publicKey,
    cloneStakingAddress,
    true
  );

  // Airdrop receivers
  const numReceivers = 100;
  const dropValues = [100, 1000, 5000];
  let airdropReceiversKp: Keypair[] = [];
  const airdropReceivers: Receiver[] = [...Array(numReceivers)].map((_) => {
    const randomIndex = Math.floor(Math.random() * dropValues.length);
    const kp = Keypair.generate();
    airdropReceiversKp.push(kp);
    return {
      address: kp.publicKey,
      amount: Math.floor(dropValues[randomIndex] * Math.pow(10, clnDecimal)),
    };
  });

  // Nonce account keypair
  const nonceAccountAddressKp = Keypair.generate();

  before("setup", async function () {
    connection = new Connection(solanaRpcUrl, "confirmed");
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
    provider = new BankrunProvider(context);

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

    // Clone staking vault and initialize the staking program.
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

    // Mint CLN tokens directly to the clone staking vault.
    // IRL we would do this via the multisig.
    let mintAmount = 0;
    airdropReceivers.forEach((r) => {
      mintAmount += r.amount;
    });
    const mintClntoVaultIx = createMintToInstruction(
      clnTokenMintKp.publicKey,
      clnStakingVault,
      context.payer.publicKey,
      mintAmount
    );
    tx.add(mintClntoVaultIx);

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
    // Create staking accounts for each user.
    for (let reciever of airdropReceivers) {
      const userAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), reciever.address.toBuffer()],
        CloneStakingProgramId
      )[0];
      let createStakeAccountIx = createInitializeUserInstruction(
        {
          payer: context.payer.publicKey,
          userAccount: userAccountAddress,
        },
        { user: reciever.address }
      );
      tx = new Transaction().add(createStakeAccountIx);
      tx.recentBlockhash = (await context.banksClient.getLatestBlockhash(
        "finalized"
      ))![0];
      tx.sign(context.payer);
      await context.banksClient.processTransaction(tx);
    }

    context.warpToSlot(slot + BigInt(1));

    airdropParams = {
      provider,
      wallet: provider.wallet,
      batchSize: 6,
      squadsMultisigPda: multisigPda,
      receivers: airdropReceivers,
      cloneStakingProgramId: CloneStakingProgramId,
      clnTokenMint: clnTokenMintKp.publicKey,
      nonceAccountAddress: nonceAccountAddressKp.publicKey,
      vault: multisigVault,
      priorityFeeMicroLamports: 200,
      banksClient: context.banksClient,
      startingSlot: 10,
      endingSlot: 1000,
    };
  });

  it("run airdrop and execute multisig transactions", async function () {
    const provider = airdropParams.provider;
    await runAirdrop(airdropParams);

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
      assert.equal(userAccount.stakedTokens.toString(), "0");
      assert.equal(
        userAccount.vesting.allocationAmount.toString(),
        receiver.amount.toString()
      );
    }
  });

  it("create some fuzz test", async () => {
    // Generate
    const runTest = async (receiverKp: Keypair, slot: number) => {
      const userAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), receiverKp.publicKey.toBuffer()],
        CloneStakingProgramId
      )[0];
      const userStakingAccount = await ClnStakingUser.fromAccountAddress(
        provider.connection,
        userAccountAddress
      );

      const ratio = Math.min(
        1,
        (slot - airdropParams.startingSlot) /
          (airdropParams.endingSlot - airdropParams.startingSlot)
      );
      const amountToWithdraw =
        Math.floor(
          Number(userStakingAccount.vesting.allocationAmount) * ratio
        ) - Number(userStakingAccount.vesting.amountWithdrawn);
      console.log("SLOT:", slot, "WITHDRAW:", amountToWithdraw);
      console.log(
        "VESTING amount, withdrawn:",
        userStakingAccount.vesting.allocationAmount.toString(),
        userStakingAccount.vesting.amountWithdrawn.toString()
      );

      const userClnTokenAccount = getAssociatedTokenAddressSync(
        clnTokenMintKp.publicKey,
        receiverKp.publicKey,
        true
      );

      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          provider.wallet.publicKey,
          userClnTokenAccount,
          receiverKp.publicKey,
          clnTokenMintKp.publicKey
        ),
        createWithdrawVestedStakeInstruction(
          {
            user: receiverKp.publicKey,
            userAccount: userAccountAddress,
            cloneStaking: cloneStakingAddress,
            clnTokenMint: clnTokenMintKp.publicKey,
            clnTokenVault: clnStakingVault,
            userClnTokenAccount,
          },
          {
            amount: amountToWithdraw,
          },
          CloneStakingProgramId
        )
      );

      const simSlot = await context.banksClient.getSlot("finalized");
      if (simSlot < slot) {
        console.log(`Warping from ${simSlot} -> ${slot}`);
        for (let i = Number(simSlot) + 1; i <= slot; i++) {
          context.warpToSlot(BigInt(i));
        }
      }

      let blockhash = (await context.banksClient.getLatestBlockhash(
        "finalized"
      ))![0];
      tx.recentBlockhash = blockhash;
      tx.sign(context.payer);
      tx.partialSign(receiverKp);

      let transactionSucceeded = false;
      try {
        await context.banksClient.processTransaction(tx);
        transactionSucceeded = true;
      } catch (e) {
        console.log(e);
      }

      const updatedUserStakingAccount = await ClnStakingUser.fromAccountAddress(
        provider.connection,
        userAccountAddress
      );

      if (slot < airdropParams.startingSlot || amountToWithdraw === 0) {
        assert.isFalse(transactionSucceeded);
        return;
      } else {
        assert.isTrue(transactionSucceeded);
      }

      assert.equal(
        Number(updatedUserStakingAccount.vesting.amountWithdrawn) -
          Number(userStakingAccount.vesting.amountWithdrawn),
        amountToWithdraw
      );

      // Should read and check account balance here.
    };

    const nTests = 1024;
    const randomIndex = (N: number, start: number = 0) => {
      return start + Math.floor(Math.random() * N);
    };
    const randomChoice = (arr: any[]) => {
      return arr[randomIndex(arr.length)];
    };

    let slots = [...Array(nTests)].map(() =>
      randomIndex(
        airdropParams.endingSlot - airdropParams.startingSlot,
        airdropParams.startingSlot
      )
    );
    slots.push(
      ...[
        airdropParams.startingSlot,
        airdropParams.endingSlot,
        airdropParams.startingSlot - 1,
        airdropParams.endingSlot + 1,
      ]
    );
    slots.sort((a, b) => a - b);
    console.log("SLOTS:", slots);

    for (const slot of slots) {
      const receiverKp = randomChoice(airdropReceiversKp);
      await runTest(receiverKp, slot);
    }
  });
});
