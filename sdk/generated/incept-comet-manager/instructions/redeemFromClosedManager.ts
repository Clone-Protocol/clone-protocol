/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as splToken from '@solana/spl-token'
import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'

/**
 * @category Instructions
 * @category RedeemFromClosedManager
 * @category generated
 */
export const redeemFromClosedManagerStruct = new beet.BeetArgsStruct<{
  instructionDiscriminator: number[] /* size: 8 */
}>(
  [['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)]],
  'RedeemFromClosedManagerInstructionArgs'
)
/**
 * Accounts required by the _redeemFromClosedManager_ instruction
 *
 * @property [**signer**] subscriber
 * @property [_writable_] subscriberAccount
 * @property [_writable_] managerInfo
 * @property [] incept
 * @property [_writable_] managerInceptUser
 * @property [_writable_] usdiMint
 * @property [_writable_] subscriberUsdiTokenAccount
 * @property [_writable_] managerUsdiTokenAccount
 * @property [] inceptProgram
 * @property [_writable_] comet
 * @property [_writable_] tokenData
 * @property [_writable_] inceptUsdiVault
 * @category Instructions
 * @category RedeemFromClosedManager
 * @category generated
 */
export type RedeemFromClosedManagerInstructionAccounts = {
  subscriber: web3.PublicKey
  subscriberAccount: web3.PublicKey
  managerInfo: web3.PublicKey
  incept: web3.PublicKey
  managerInceptUser: web3.PublicKey
  usdiMint: web3.PublicKey
  subscriberUsdiTokenAccount: web3.PublicKey
  managerUsdiTokenAccount: web3.PublicKey
  inceptProgram: web3.PublicKey
  comet: web3.PublicKey
  tokenData: web3.PublicKey
  inceptUsdiVault: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const redeemFromClosedManagerInstructionDiscriminator = [
  92, 140, 109, 209, 98, 44, 211, 239,
]

/**
 * Creates a _RedeemFromClosedManager_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @category Instructions
 * @category RedeemFromClosedManager
 * @category generated
 */
export function createRedeemFromClosedManagerInstruction(
  accounts: RedeemFromClosedManagerInstructionAccounts,
  programId = new web3.PublicKey('CNEvgsmVcYBwUzWQj6iss9MJaFDAzpF8BHSEjejLTXDh')
) {
  const [data] = redeemFromClosedManagerStruct.serialize({
    instructionDiscriminator: redeemFromClosedManagerInstructionDiscriminator,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.subscriber,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.subscriberAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.managerInfo,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.incept,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.managerInceptUser,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.usdiMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.subscriberUsdiTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.managerUsdiTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.inceptProgram,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.comet,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenData,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.inceptUsdiVault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenProgram ?? splToken.TOKEN_PROGRAM_ID,
      isWritable: false,
      isSigner: false,
    },
  ]

  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc)
    }
  }

  const ix = new web3.TransactionInstruction({
    programId,
    keys,
    data,
  })
  return ix
}
