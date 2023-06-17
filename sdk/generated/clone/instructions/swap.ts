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
 * @category Swap
 * @category generated
 */
export type SwapInstructionArgs = {
  poolIndex: number
  quantity: beet.bignum
  quantityIsInput: boolean
  quantityIsOnusd: boolean
  resultThreshold: beet.bignum
}
/**
 * @category Instructions
 * @category Swap
 * @category generated
 */
export const swapStruct = new beet.BeetArgsStruct<
  SwapInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['poolIndex', beet.u8],
    ['quantity', beet.u64],
    ['quantityIsInput', beet.bool],
    ['quantityIsOnusd', beet.bool],
    ['resultThreshold', beet.u64],
  ],
  'SwapInstructionArgs'
)
/**
 * Accounts required by the _swap_ instruction
 *
 * @property [**signer**] user
 * @property [_writable_] clone
 * @property [_writable_] tokenData
 * @property [_writable_] userOnusdTokenAccount
 * @property [_writable_] userOnassetTokenAccount
 * @property [_writable_] onassetMint
 * @property [_writable_] onusdMint
 * @property [_writable_] treasuryOnassetTokenAccount
 * @property [_writable_] treasuryOnusdTokenAccount
 * @category Instructions
 * @category Swap
 * @category generated
 */
export type SwapInstructionAccounts = {
  user: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  userOnusdTokenAccount: web3.PublicKey
  userOnassetTokenAccount: web3.PublicKey
  onassetMint: web3.PublicKey
  onusdMint: web3.PublicKey
  treasuryOnassetTokenAccount: web3.PublicKey
  treasuryOnusdTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const swapInstructionDiscriminator = [
  248, 198, 158, 145, 225, 117, 135, 200,
]

/**
 * Creates a _Swap_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category Swap
 * @category generated
 */
export function createSwapInstruction(
  accounts: SwapInstructionAccounts,
  args: SwapInstructionArgs,
  programId = new web3.PublicKey('BxUeKSA62ME4uZZH5gJ3p3co47D8RiZzdLwZSyNgs4sJ')
) {
  const [data] = swapStruct.serialize({
    instructionDiscriminator: swapInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.user,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.clone,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenData,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userOnusdTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.onassetMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.onusdMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.treasuryOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.treasuryOnusdTokenAccount,
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