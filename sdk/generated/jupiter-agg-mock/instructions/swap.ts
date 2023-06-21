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
  nonce: number
  assetIndex: number
  isAmountInput: boolean
  isAmountAsset: boolean
  amount: beet.bignum
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
    ['nonce', beet.u8],
    ['assetIndex', beet.u8],
    ['isAmountInput', beet.bool],
    ['isAmountAsset', beet.bool],
    ['amount', beet.u64],
  ],
  'SwapInstructionArgs'
)
/**
 * Accounts required by the _swap_ instruction
 *
 * @property [**signer**] user
 * @property [] jupiterAccount
 * @property [_writable_] assetMint
 * @property [_writable_] usdcMint
 * @property [_writable_] userAssetTokenAccount
 * @property [_writable_] userUsdcTokenAccount
 * @property [] pythOracle
 * @category Instructions
 * @category Swap
 * @category generated
 */
export type SwapInstructionAccounts = {
  user: web3.PublicKey
  jupiterAccount: web3.PublicKey
  assetMint: web3.PublicKey
  usdcMint: web3.PublicKey
  userAssetTokenAccount: web3.PublicKey
  userUsdcTokenAccount: web3.PublicKey
  pythOracle: web3.PublicKey
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
  programId = new web3.PublicKey('J2shPGHLAPYe1i6PWuKBTXMzGFDSi1yYUzus5yxekH2a')
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
      pubkey: accounts.jupiterAccount,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.assetMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.usdcMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userAssetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userUsdcTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.pythOracle,
      isWritable: false,
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
