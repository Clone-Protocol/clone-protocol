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
 * @category DeprecatePool
 * @category generated
 */
export type DeprecatePoolInstructionArgs = {
  poolIndex: number
}
/**
 * @category Instructions
 * @category DeprecatePool
 * @category generated
 */
export const deprecatePoolStruct = new beet.BeetArgsStruct<
  DeprecatePoolInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['poolIndex', beet.u8],
  ],
  'DeprecatePoolInstructionArgs'
)
/**
 * Accounts required by the _deprecatePool_ instruction
 *
 * @property [**signer**] admin
 * @property [] clone
 * @property [_writable_] tokenData
 * @category Instructions
 * @category DeprecatePool
 * @category generated
 */
export type DeprecatePoolInstructionAccounts = {
  admin: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const deprecatePoolInstructionDiscriminator = [
  27, 99, 47, 6, 56, 127, 199, 154,
]

/**
 * Creates a _DeprecatePool_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category DeprecatePool
 * @category generated
 */
export function createDeprecatePoolInstruction(
  accounts: DeprecatePoolInstructionAccounts,
  args: DeprecatePoolInstructionArgs,
  programId = new web3.PublicKey('6xmjJPzcUQHb7Dhii4EfqvP8UxanxWYwRSpVY4yAUa2g')
) {
  const [data] = deprecatePoolStruct.serialize({
    instructionDiscriminator: deprecatePoolInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.admin,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.clone,
      isWritable: false,
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