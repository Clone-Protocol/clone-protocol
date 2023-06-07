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
 * @category MintOnusdDevnet
 * @category generated
 */
export type MintOnusdDevnetInstructionArgs = {
  amount: beet.bignum
}
/**
 * @category Instructions
 * @category MintOnusdDevnet
 * @category generated
 */
export const mintOnusdDevnetStruct = new beet.BeetArgsStruct<
  MintOnusdDevnetInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['amount', beet.u64],
  ],
  'MintOnusdDevnetInstructionArgs'
)
/**
 * Accounts required by the _mintOnusdDevnet_ instruction
 *
 * @property [**signer**] user
 * @property [] clone
 * @property [_writable_] tokenData
 * @property [_writable_] onusdMint
 * @property [_writable_] userOnusdTokenAccount
 * @category Instructions
 * @category MintOnusdDevnet
 * @category generated
 */
export type MintOnusdDevnetInstructionAccounts = {
  user: web3.PublicKey
  clone: web3.PublicKey
  tokenData: web3.PublicKey
  onusdMint: web3.PublicKey
  userOnusdTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const mintOnusdDevnetInstructionDiscriminator = [
  27, 24, 200, 100, 18, 3, 105, 89,
]

/**
 * Creates a _MintOnusdDevnet_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category MintOnusdDevnet
 * @category generated
 */
export function createMintOnusdDevnetInstruction(
  accounts: MintOnusdDevnetInstructionAccounts,
  args: MintOnusdDevnetInstructionArgs,
  programId = new web3.PublicKey('6xmjJPzcUQHb7Dhii4EfqvP8UxanxWYwRSpVY4yAUa2g')
) {
  const [data] = mintOnusdDevnetStruct.serialize({
    instructionDiscriminator: mintOnusdDevnetInstructionDiscriminator,
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