import { AddedAccount, ProgramTestContext } from "solana-bankrun";
import {
  Connection,
  PublicKey,
  Keypair,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  AccountLayout,
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

export const setTokenAccount = (
  context: ProgramTestContext,
  owner: PublicKey,
  mint: PublicKey,
  amount: bigint,
  allowOwnerOffCurve?: boolean
): PublicKey => {
  const ata = getAssociatedTokenAddressSync(owner, mint, allowOwnerOffCurve);
  // Create accounts for USDC and wSOL
  const data = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      delegatedAmount: 0n,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data
  );
  context.setAccount(ata, {
    lamports: 1_000_000,
    data,
    owner: TOKEN_PROGRAM_ID,
    executable: false,
  });
  return ata;
};

// Creates an associated token account for the payer if needed,
// Otherwise, mints tokens to the payer's account utilizing
// A manually set proxy address
export const mintTokenToDestination = async (
  context: ProgramTestContext,
  mint: PublicKey,
  amount: bigint,
  destination?: PublicKey
) => {
  // Create a fake proxy USDC token account for payer
  const dest = destination ?? context.payer.publicKey;
  const destinationMintAta = getAssociatedTokenAddressSync(mint, dest, true);
  const destinationMintAtaInfo = await context.banksClient.getAccount(
    destinationMintAta
  );

  let tx = new Transaction();
  tx.feePayer = context.payer.publicKey;
  tx.recentBlockhash = context.lastBlockhash;
  // Check if account needs to be created.
  if (destinationMintAtaInfo === null) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        context.payer.publicKey,
        destinationMintAta,
        dest,
        mint
      )
    );
  }
  // Send tokens from proxy to payer
  if (amount > 0) {
    const proxy = Keypair.generate();
    const proxyMintAta = setTokenAccount(
      context,
      proxy.publicKey,
      mint,
      amount
    );
    tx.add(
      createTransferInstruction(
        proxyMintAta,
        destinationMintAta,
        proxy.publicKey,
        amount
      )
    );
    tx.sign(context.payer);
    tx.partialSign(proxy);
  } else {
    tx.sign(context.payer);
  }

  await context.banksClient.processTransaction(tx);

  return destinationMintAta;
};

export const fetchAccounts = async (
  rpc_endpoint: string,
  accountPubkeys: PublicKey[]
): Promise<AddedAccount[]> => {
  if (accountPubkeys.length > 100) {
    throw new Error("Can't request for more than 100 at a time!");
  }

  const connection = new Connection(rpc_endpoint, {
    commitment: "confirmed",
  });

  const accounts = await connection.getMultipleAccountsInfo(accountPubkeys, {
    commitment: "confirmed",
  });

  let addedAccounts: AddedAccount[] = [];
  accounts.forEach((account, i) => {
    if (account === null) {
      return;
    }
    addedAccounts.push({
      address: accountPubkeys[i],
      info: {
        lamports: account.lamports,
        data: account.data,
        owner: account.owner,
        executable: account.executable,
      },
    });
  });
  return addedAccounts;
};
