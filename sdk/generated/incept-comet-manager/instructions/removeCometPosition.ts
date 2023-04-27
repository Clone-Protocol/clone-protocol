/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'

/**
 * @category Instructions
 * @category RemoveCometPosition
 * @category generated
 */
export type RemoveCometPositionInstructionArgs = {
  cometPositionIndex: number
}
/**
 * @category Instructions
 * @category RemoveCometPosition
 * @category generated
 */
export const removeCometPositionStruct = new beet.BeetArgsStruct<
  RemoveCometPositionInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['cometPositionIndex', beet.u8],
  ],
  'RemoveCometPositionInstructionArgs'
)
/**
 * Accounts required by the _removeCometPosition_ instruction
 *
 * @property [**signer**] signer
 * @property [] managerInfo
 * @property [_writable_] incept
 * @property [_writable_] managerInceptUser
 * @property [] inceptProgram
 * @property [_writable_] comet
 * @property [_writable_] tokenData
 * @category Instructions
 * @category RemoveCometPosition
 * @category generated
 */
export type RemoveCometPositionInstructionAccounts = {
  signer: web3.PublicKey
  managerInfo: web3.PublicKey
  incept: web3.PublicKey
  managerInceptUser: web3.PublicKey
  inceptProgram: web3.PublicKey
  comet: web3.PublicKey
  tokenData: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const removeCometPositionInstructionDiscriminator = [
  168, 73, 75, 213, 103, 99, 152, 104,
]

/**
 * Creates a _RemoveCometPosition_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category RemoveCometPosition
 * @category generated
 */
export function createRemoveCometPositionInstruction(
  accounts: RemoveCometPositionInstructionAccounts,
  args: RemoveCometPositionInstructionArgs,
  programId = new web3.PublicKey('6HAQXsz7ScT5SueXukgDB8ExE9FKeqj5q1z925SujZsu')
) {
  const [data] = removeCometPositionStruct.serialize({
    instructionDiscriminator: removeCometPositionInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.signer,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.managerInfo,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.incept,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.managerInceptUser,
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