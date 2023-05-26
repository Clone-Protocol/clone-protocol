/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'
import { PoolIndices, poolIndicesBeet } from '../types/PoolIndices'

/**
 * @category Instructions
 * @category UpdatePrices
 * @category generated
 */
export type UpdatePricesInstructionArgs = {
  poolIndices: PoolIndices
}
/**
 * @category Instructions
 * @category UpdatePrices
 * @category generated
 */
export const updatePricesStruct = new beet.BeetArgsStruct<
  UpdatePricesInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['poolIndices', poolIndicesBeet],
  ],
  'UpdatePricesInstructionArgs'
)
/**
 * Accounts required by the _updatePrices_ instruction
 *
 * @property [] incept
 * @property [_writable_] tokenData
 * @category Instructions
 * @category UpdatePrices
 * @category generated
 */
export type UpdatePricesInstructionAccounts = {
  incept: web3.PublicKey
  tokenData: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const updatePricesInstructionDiscriminator = [
  62, 161, 234, 136, 106, 26, 18, 160,
]

/**
 * Creates a _UpdatePrices_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category UpdatePrices
 * @category generated
 */
export function createUpdatePricesInstruction(
  accounts: UpdatePricesInstructionAccounts,
  args: UpdatePricesInstructionArgs,
  programId = new web3.PublicKey('7nDVRAFPTYDfcSZv9F7JxfbFxNDABfB1edG7gKHavwpt')
) {
  const [data] = updatePricesStruct.serialize({
    instructionDiscriminator: updatePricesInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.incept,
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
