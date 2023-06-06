import { BN } from "@coral-xyz/anchor";
import { CloneClient } from "./clone";
import { Network, DEV_NET, TEST_NET } from "./network";
import { PublicKey, Transaction } from "@solana/web3.js";
export interface IWallet {
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  publicKey: PublicKey;
}
export { BN, Network, CloneClient, DEV_NET, TEST_NET };
