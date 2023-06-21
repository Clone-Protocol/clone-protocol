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
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export type WithdrawCollateralFromCometInstructionArgs = {
  cometCollateralIndex: number
  collateralAmount: beet.bignum
}
/**
 * @category Instructions
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export const withdrawCollateralFromCometStruct = new beet.BeetArgsStruct<
  WithdrawCollateralFromCometInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['cometCollateralIndex', beet.u8],
    ['collateralAmount', beet.u64],
  ],
  'WithdrawCollateralFromCometInstructionArgs'
)
/**
 * Accounts required by the _withdrawCollateralFromComet_ instruction
 *
 * @property [**signer**] user
 * @property [] userAccount
 * @property [] clone
 * @property [_writable_] tokenData
 * @property [_writable_] comet
 * @property [_writable_] vault
 * @property [_writable_] userCollateralTokenAccount
 * @category Instructions
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export type WithdrawCollateralFromCometInstructionAccounts = {
  user: web3.PublicKey
  userAccount: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  comet: web3.PublicKey
  vault: web3.PublicKey
  userCollateralTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const withdrawCollateralFromCometInstructionDiscriminator = [
  208, 162, 137, 187, 186, 161, 87, 136,
]

/**
 * Creates a _WithdrawCollateralFromComet_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export function createWithdrawCollateralFromCometInstruction(
  accounts: WithdrawCollateralFromCometInstructionAccounts,
  args: WithdrawCollateralFromCometInstructionArgs,
  programId = new web3.PublicKey('BxUeKSA62ME4uZZH5gJ3p3co47D8RiZzdLwZSyNgs4sJ')
) {
  const [data] = withdrawCollateralFromCometStruct.serialize({
    instructionDiscriminator:
      withdrawCollateralFromCometInstructionDiscriminator,
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
