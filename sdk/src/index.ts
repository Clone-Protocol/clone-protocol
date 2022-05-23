import { BN } from '@project-serum/anchor'
import { Incept } from './incept'
import { Network, DEV_NET, TEST_NET } from './network'
import {
  signAndSend,
} from './utils'
import { PublicKey, Transaction } from '@solana/web3.js'
export interface IWallet {
  signTransaction(tx: Transaction): Promise<Transaction>
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>
  publicKey: PublicKey
}
export {
  BN,
  Network,
  Incept,
  signAndSend,
  DEV_NET,
  TEST_NET
}