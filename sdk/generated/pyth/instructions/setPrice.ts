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
 * @category SetPrice
 * @category generated
 */
export type SetPriceInstructionArgs = {
  price: beet.bignum
}
/**
 * @category Instructions
 * @category SetPrice
 * @category generated
 */
export const setPriceStruct = new beet.BeetArgsStruct<
  SetPriceInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['price', beet.i64],
  ],
  'SetPriceInstructionArgs'
)
/**
 * Accounts required by the _setPrice_ instruction
 *
 * @property [_writable_] price
 * @category Instructions
 * @category SetPrice
 * @category generated
 */
export type SetPriceInstructionAccounts = {
  price: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const setPriceInstructionDiscriminator = [
  16, 19, 182, 8, 149, 83, 72, 181,
]

/**
 * Creates a _SetPrice_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category SetPrice
 * @category generated
 */
export function createSetPriceInstruction(
  accounts: SetPriceInstructionAccounts,
  args: SetPriceInstructionArgs,
  programId = new web3.PublicKey('H38XT5NKW9g9sZpmjwDQkp6S3nLTfg7tZ4WbAfgk7ZCG')
) {
  const [data] = setPriceStruct.serialize({
    instructionDiscriminator: setPriceInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.price,
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
