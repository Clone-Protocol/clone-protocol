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
 * @category Initialize
 * @category generated
 */
export type InitializeInstructionArgs = {
  stakingPeriodSlots: beet.bignum
}
/**
 * @category Instructions
 * @category Initialize
 * @category generated
 */
export const initializeStruct = new beet.BeetArgsStruct<
  InitializeInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['stakingPeriodSlots', beet.u64],
  ],
  'InitializeInstructionArgs'
)
/**
 * Accounts required by the _initialize_ instruction
 *
 * @property [_writable_, **signer**] admin
 * @property [_writable_] cloneStaking
 * @property [] clnTokenMint
 * @property [] clnTokenVault
 * @category Instructions
 * @category Initialize
 * @category generated
 */
export type InitializeInstructionAccounts = {
  admin: web3.PublicKey
  cloneStaking: web3.PublicKey
  clnTokenMint: web3.PublicKey
  clnTokenVault: web3.PublicKey
  rent?: web3.PublicKey
  tokenProgram?: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const initializeInstructionDiscriminator = [
  175, 175, 109, 31, 13, 152, 155, 237,
]

/**
 * Creates a _Initialize_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category Initialize
 * @category generated
 */
export function createInitializeInstruction(
  accounts: InitializeInstructionAccounts,
  args: InitializeInstructionArgs,
  programId = new web3.PublicKey('6yb6cqAvngy2do4qAFmM24Jda2FfyXcPuQxu4P3Va2F4')
) {
  const [data] = initializeStruct.serialize({
    instructionDiscriminator: initializeInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.admin,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.cloneStaking,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.clnTokenMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.clnTokenVault,
      isWritable: false,
      isSigner: false,
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