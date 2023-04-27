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
 * @category AddLiquidityToSinglePoolComet
 * @category generated
 */
export type AddLiquidityToSinglePoolCometInstructionArgs = {
  positionIndex: number
  usdiAmount: beet.bignum
}
/**
 * @category Instructions
 * @category AddLiquidityToSinglePoolComet
 * @category generated
 */
export const addLiquidityToSinglePoolCometStruct = new beet.BeetArgsStruct<
  AddLiquidityToSinglePoolCometInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['positionIndex', beet.u8],
    ['usdiAmount', beet.u64],
  ],
  'AddLiquidityToSinglePoolCometInstructionArgs'
)
/**
 * Accounts required by the _addLiquidityToSinglePoolComet_ instruction
 *
 * @property [**signer**] user
 * @property [] userAccount
 * @property [_writable_] incept
 * @property [_writable_] tokenData
 * @property [_writable_] singlePoolComet
 * @property [_writable_] usdiMint
 * @property [_writable_] iassetMint
 * @property [_writable_] ammUsdiTokenAccount
 * @property [_writable_] ammIassetTokenAccount
 * @property [_writable_] liquidityTokenMint
 * @property [_writable_] cometLiquidityTokenAccount
 * @category Instructions
 * @category AddLiquidityToSinglePoolComet
 * @category generated
 */
export type AddLiquidityToSinglePoolCometInstructionAccounts = {
  user: web3.PublicKey
  userAccount: web3.PublicKey
  incept: web3.PublicKey
  tokenData: web3.PublicKey
  singlePoolComet: web3.PublicKey
  usdiMint: web3.PublicKey
  iassetMint: web3.PublicKey
  ammUsdiTokenAccount: web3.PublicKey
  ammIassetTokenAccount: web3.PublicKey
  liquidityTokenMint: web3.PublicKey
  cometLiquidityTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const addLiquidityToSinglePoolCometInstructionDiscriminator = [
  35, 66, 188, 71, 10, 31, 182, 112,
]

/**
 * Creates a _AddLiquidityToSinglePoolComet_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category AddLiquidityToSinglePoolComet
 * @category generated
 */
export function createAddLiquidityToSinglePoolCometInstruction(
  accounts: AddLiquidityToSinglePoolCometInstructionAccounts,
  args: AddLiquidityToSinglePoolCometInstructionArgs,
  programId = new web3.PublicKey('5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1')
) {
  const [data] = addLiquidityToSinglePoolCometStruct.serialize({
    instructionDiscriminator:
      addLiquidityToSinglePoolCometInstructionDiscriminator,
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
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenData,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.singlePoolComet,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.usdiMint,
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