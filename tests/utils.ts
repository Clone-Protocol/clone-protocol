import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Provider, BN } from "@coral-xyz/anchor";
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
import { Decimal, toNumber } from "../sdk/src/decimal";
import { DEVNET_TOKEN_SCALE, InceptClient, toDevnetScale } from "../sdk/src/incept";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Comet, TokenData } from "../sdk/src/interfaces";

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
  console.log(associatedToken.toString())

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
      try {
        await provider.sendAndConfirm!(transaction, [], {commitment: "confirmed"});
      } catch (error2: unknown) {
        console.log('Error creating ata for', mint.toString(), associatedToken.toString(), (owner ? owner : provider.publicKey!).toString())
        throw error2
      }
      account = await getAccount(
        provider.connection,
        associatedToken,
        "recent",
        TOKEN_PROGRAM_ID
      );
    } else {
      console.log("UNRECOGNIZED ERROR!")
      throw error;
    }
  }

  if (!account) {
    throw Error("Could not create account!");
  }
  if (associatedToken.toString() === "CjBkBhxQG2w6LEZn34T2QhGRszgPz8eU5urV2jBU4bSS") console.log("OK THIS WORKED...")
  return account;
};

export const convertToRawDecimal = (num: number) => {
  let temp = new Decimal(BigInt(toDevnetScale(num).toNumber()), BigInt(DEVNET_TOKEN_SCALE));
  return temp.toRawDecimal();
}

export const fromDevnetNumber = (x: BN | bigint | number): number => {
  return Number(x) * Math.pow(10, -DEVNET_TOKEN_SCALE);
}
