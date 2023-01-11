import { BN } from "@project-serum/anchor";
import { Incept } from "./incept";
import { Network, DEV_NET, TEST_NET } from "./network";
import { PublicKey, Transaction } from "@solana/web3.js";
export interface IWallet {
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  publicKey: PublicKey;
}
export { BN, Network, Incept, DEV_NET, TEST_NET };
