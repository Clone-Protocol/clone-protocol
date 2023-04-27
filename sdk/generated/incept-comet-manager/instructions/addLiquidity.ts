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
 * @category AddLiquidity
 * @category generated
 */
export type AddLiquidityInstructionArgs = {
  poolIndex: number
  usdiAmount: beet.bignum
}
/**
 * @category Instructions
 * @category AddLiquidity
 * @category generated
 */
export const addLiquidityStruct = new beet.BeetArgsStruct<
  AddLiquidityInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['poolIndex', beet.u8],
    ['usdiAmount', beet.u64],
  ],
  'AddLiquidityInstructionArgs'
)
/**
 * Accounts required by the _addLiquidity_ instruction
 *
 * @property [**signer**] managerOwner
 * @property [] managerInfo
 * @property [_writable_] incept
 * @property [_writable_] managerInceptUser
 * @property [_writable_] usdiMint
 * @property [] inceptProgram
 * @property [_writable_] comet
 * @property [_writable_] tokenData
 * @property [_writable_] iassetMint
 * @property [_writable_] ammUsdiTokenAccount
 * @property [_writable_] ammIassetTokenAccount
 * @property [_writable_] liquidityTokenMint
 * @property [_writable_] cometLiquidityTokenAccount
 * @category Instructions
 * @category AddLiquidity
 * @category generated
 */
export type AddLiquidityInstructionAccounts = {
  managerOwner: web3.PublicKey
  managerInfo: web3.PublicKey
  incept: web3.PublicKey
  managerInceptUser: web3.PublicKey
  usdiMint: web3.PublicKey
  inceptProgram: web3.PublicKey
  comet: web3.PublicKey
  tokenData: web3.PublicKey
  iassetMint: web3.PublicKey
  ammUsdiTokenAccount: web3.PublicKey
  ammIassetTokenAccount: web3.PublicKey
  liquidityTokenMint: web3.PublicKey
  cometLiquidityTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const addLiquidityInstructionDiscriminator = [
  181, 157, 89, 67, 143, 182, 52, 72,
]

/**
 * Creates a _AddLiquidity_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category AddLiquidity
 * @category generated
 */
export function createAddLiquidityInstruction(
  accounts: AddLiquidityInstructionAccounts,
  args: AddLiquidityInstructionArgs,
  programId = new web3.PublicKey('6HAQXsz7ScT5SueXukgDB8ExE9FKeqj5q1z925SujZsu')
) {
  const [data] = addLiquidityStruct.serialize({
    instructionDiscriminator: addLiquidityInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.managerOwner,
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
      pubkey: accounts.usdiMint,
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
      pubkey: accounts.iassetMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.ammUsdiTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.ammIassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.liquidityTokenMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.cometLiquidityTokenAccount,
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