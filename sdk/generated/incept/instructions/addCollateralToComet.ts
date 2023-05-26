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
 * @category AddCollateralToComet
 * @category generated
 */
export type AddCollateralToCometInstructionArgs = {
  collateralIndex: number
  collateralAmount: beet.bignum
}
/**
 * @category Instructions
 * @category AddCollateralToComet
 * @category generated
 */
export const addCollateralToCometStruct = new beet.BeetArgsStruct<
  AddCollateralToCometInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['collateralIndex', beet.u8],
    ['collateralAmount', beet.u64],
  ],
  'AddCollateralToCometInstructionArgs'
)
/**
 * Accounts required by the _addCollateralToComet_ instruction
 *
 * @property [**signer**] user
 * @property [] userAccount
 * @property [] incept
 * @property [_writable_] tokenData
 * @property [_writable_] comet
 * @property [_writable_] vault
 * @property [_writable_] userCollateralTokenAccount
 * @category Instructions
 * @category AddCollateralToComet
 * @category generated
 */
export type AddCollateralToCometInstructionAccounts = {
  user: web3.PublicKey
  userAccount: web3.PublicKey
  incept: web3.PublicKey
  tokenData: web3.PublicKey
  comet: web3.PublicKey
  vault: web3.PublicKey
  userCollateralTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const addCollateralToCometInstructionDiscriminator = [
  209, 211, 225, 123, 219, 71, 154, 232,
]

/**
 * Creates a _AddCollateralToComet_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category AddCollateralToComet
 * @category generated
 */
export function createAddCollateralToCometInstruction(
  accounts: AddCollateralToCometInstructionAccounts,
  args: AddCollateralToCometInstructionArgs,
  programId = new web3.PublicKey('7nDVRAFPTYDfcSZv9F7JxfbFxNDABfB1edG7gKHavwpt')
) {
  const [data] = addCollateralToCometStruct.serialize({
    instructionDiscriminator: addCollateralToCometInstructionDiscriminator,
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
      isWritable: false,
      isSigner: false,
    },
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
    {
      pubkey: accounts.comet,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.vault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userCollateralTokenAccount,
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
