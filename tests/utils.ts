import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";

export const INCEPT_EXCHANGE_SEED = Buffer.from("Incept");
export const EXCHANGE_ADMIN = new Keypair();
export const DEFAULT_PUBLIC_KEY = new PublicKey(0);
