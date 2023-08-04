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
 * @property [**signer**] user
 * @property [_writable_] userAccount
 * @property [_writable_] tokenData
 * @category Instructions
 * @category RemoveCometPosition
 * @category generated
 */
export type RemoveCometPositionInstructionAccounts = {
  user: web3.PublicKey
  userAccount: web3.PublicKey
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
  programId = new web3.PublicKey('F7KEvEhxAQ5AXKRSRHruSF55jcUxVv6S45ohkHvStd5v')
) {
  const [data] = removeCometPositionStruct.serialize({
    instructionDiscriminator: removeCometPositionInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.user,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.userAccount,
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
