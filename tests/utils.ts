import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Provider } from "@project-serum/anchor";
import {
  Account,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sleep } from "../sdk/src/utils";
import { Decimal } from "../sdk/src/decimal";
import { DEVNET_TOKEN_SCALE, toDevnetScale } from "../sdk/src/incept";

export const INCEPT_EXCHANGE_SEED = Buffer.from("Incept");
export const EXCHANGE_ADMIN = new Keypair();
export const DEFAULT_PUBLIC_KEY = new PublicKey(0);

export const getOrCreateAssociatedTokenAccount = async (
  provider: Provider,
  mint: PublicKey,
  owner?: PublicKey,
  ownerOffCurve?: boolean
): Promise<Account> => {
  const associatedToken = await getAssociatedTokenAddress(
    mint,
    owner !== undefined ? owner : provider.publicKey!,
    ownerOffCurve !== undefined ? ownerOffCurve : false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  let account: Account;
  try {
    account = await getAccount(
      provider.connection,
      associatedToken,
      "recent",
      TOKEN_PROGRAM_ID
    );
  } catch (error: unknown) {
    if (error instanceof TokenAccountNotFoundError) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey!,
          associatedToken,
          owner ? owner : provider.publicKey!,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      await provider.sendAndConfirm!(transaction);
      await sleep(200);
      account = await getAccount(
        provider.connection,
        associatedToken,
        "recent",
        TOKEN_PROGRAM_ID
      );
    } else {
      throw error;
    }
  }

  if (!account) {
    throw Error("Could not create account!");
  }
  return account;
};

export const convertToRawDecimal = (num: number) => {
  let temp = new Decimal(BigInt(toDevnetScale(num).toNumber()), BigInt(DEVNET_TOKEN_SCALE));
  return temp.toRawDecimal();
}
