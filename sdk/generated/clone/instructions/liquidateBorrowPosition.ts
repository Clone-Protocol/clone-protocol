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
 * @category LiquidateBorrowPosition
 * @category generated
 */
export type LiquidateBorrowPositionInstructionArgs = {
  borrowIndex: number
}
/**
 * @category Instructions
 * @category LiquidateBorrowPosition
 * @category generated
 */
export const liquidateBorrowPositionStruct = new beet.BeetArgsStruct<
  LiquidateBorrowPositionInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['borrowIndex', beet.u8],
  ],
  'LiquidateBorrowPositionInstructionArgs'
)
/**
 * Accounts required by the _liquidateBorrowPosition_ instruction
 *
 * @property [**signer**] liquidator
 * @property [] clone
 * @property [_writable_] tokenData
 * @property [] user
 * @property [] userAccount
 * @property [_writable_] onassetMint
 * @property [_writable_] borrowPositions
 * @property [_writable_] vault
 * @property [_writable_] ammOnusdTokenAccount
 * @property [_writable_] ammOnassetTokenAccount
 * @property [_writable_] liquidatorCollateralTokenAccount
 * @property [_writable_] liquidatorOnassetTokenAccount
 * @category Instructions
 * @category LiquidateBorrowPosition
 * @category generated
 */
export type LiquidateBorrowPositionInstructionAccounts = {
  liquidator: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  user: web3.PublicKey
  userAccount: web3.PublicKey
  onassetMint: web3.PublicKey
  borrowPositions: web3.PublicKey
  vault: web3.PublicKey
  ammOnusdTokenAccount: web3.PublicKey
  ammOnassetTokenAccount: web3.PublicKey
  liquidatorCollateralTokenAccount: web3.PublicKey
  liquidatorOnassetTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const liquidateBorrowPositionInstructionDiscriminator = [
  235, 201, 17, 133, 234, 72, 84, 210,
]

/**
 * Creates a _LiquidateBorrowPosition_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category LiquidateBorrowPosition
 * @category generated
 */
export function createLiquidateBorrowPositionInstruction(
  accounts: LiquidateBorrowPositionInstructionAccounts,
  args: LiquidateBorrowPositionInstructionArgs,
  programId = new web3.PublicKey('6xmjJPzcUQHb7Dhii4EfqvP8UxanxWYwRSpVY4yAUa2g')
) {
  const [data] = liquidateBorrowPositionStruct.serialize({
    instructionDiscriminator: liquidateBorrowPositionInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.liquidator,
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
    {
      pubkey: accounts.user,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.userAccount,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.onassetMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.borrowPositions,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.vault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.ammOnusdTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.ammOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.liquidatorCollateralTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.liquidatorOnassetTokenAccount,
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