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
 * @category BurnOnusd
 * @category generated
 */
export type BurnOnusdInstructionArgs = {
  amount: beet.bignum
}
/**
 * @category Instructions
 * @category BurnOnusd
 * @category generated
 */
export const burnOnusdStruct = new beet.BeetArgsStruct<
  BurnOnusdInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['amount', beet.u64],
  ],
  'BurnOnusdInstructionArgs'
)
/**
 * Accounts required by the _burnOnusd_ instruction
 *
 * @property [**signer**] user
 * @property [] clone
 * @property [_writable_] tokenData
 * @property [_writable_] usdcVault
 * @property [_writable_] onusdMint
 * @property [_writable_] userOnusdTokenAccount
 * @property [_writable_] userCollateralTokenAccount
 * @category Instructions
 * @category BurnOnusd
 * @category generated
 */
export type BurnOnusdInstructionAccounts = {
  user: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  usdcVault: web3.PublicKey
  onusdMint: web3.PublicKey
  userOnusdTokenAccount: web3.PublicKey
  userCollateralTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const burnOnusdInstructionDiscriminator = [
  6, 23, 61, 244, 102, 16, 169, 60,
]

/**
 * Creates a _BurnOnusd_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category BurnOnusd
 * @category generated
 */
export function createBurnOnusdInstruction(
  accounts: BurnOnusdInstructionAccounts,
  args: BurnOnusdInstructionArgs,
  programId = new web3.PublicKey('GCXnnWFmt4zFmoAo2nRGe4qQyuusLzDW7CVN484bHMvA')
) {
  const [data] = burnOnusdStruct.serialize({
    instructionDiscriminator: burnOnusdInstructionDiscriminator,
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
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenData,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.usdcVault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.onusdMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userOnusdTokenAccount,
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
