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
 * @category AddCollateral
 * @category generated
 */
export type AddCollateralInstructionArgs = {
  scale: number
  stable: boolean
  collateralizationRatio: beet.bignum
  poolIndex: number
}
/**
 * @category Instructions
 * @category AddCollateral
 * @category generated
 */
export const addCollateralStruct = new beet.BeetArgsStruct<
  AddCollateralInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['scale', beet.u8],
    ['stable', beet.bool],
    ['collateralizationRatio', beet.u64],
    ['poolIndex', beet.u8],
  ],
  'AddCollateralInstructionArgs'
)
/**
 * Accounts required by the _addCollateral_ instruction
 *
 * @property [_writable_, **signer**] admin
 * @property [] clone
 * @property [_writable_] tokenData
 * @property [] collateralMint
 * @property [_writable_, **signer**] vault
 * @category Instructions
 * @category AddCollateral
 * @category generated
 */
export type AddCollateralInstructionAccounts = {
  admin: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  collateralMint: web3.PublicKey
  vault: web3.PublicKey
  rent?: web3.PublicKey
  tokenProgram?: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const addCollateralInstructionDiscriminator = [
  127, 82, 121, 42, 161, 176, 249, 206,
]

/**
 * Creates a _AddCollateral_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category AddCollateral
 * @category generated
 */
export function createAddCollateralInstruction(
  accounts: AddCollateralInstructionAccounts,
  args: AddCollateralInstructionArgs,
  programId = new web3.PublicKey('BxUeKSA62ME4uZZH5gJ3p3co47D8RiZzdLwZSyNgs4sJ')
) {
  const [data] = addCollateralStruct.serialize({
    instructionDiscriminator: addCollateralInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.admin,
      isWritable: true,
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
      pubkey: accounts.collateralMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.vault,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.rent ?? web3.SYSVAR_RENT_PUBKEY,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenProgram ?? splToken.TOKEN_PROGRAM_ID,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.systemProgram ?? web3.SystemProgram.programId,
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
