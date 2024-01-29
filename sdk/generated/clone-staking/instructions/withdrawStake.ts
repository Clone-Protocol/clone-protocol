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
 * @category WithdrawStake
 * @category generated
 */
export type WithdrawStakeInstructionArgs = {
  amount: beet.bignum
}
/**
 * @category Instructions
 * @category WithdrawStake
 * @category generated
 */
export const withdrawStakeStruct = new beet.BeetArgsStruct<
  WithdrawStakeInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['amount', beet.u64],
  ],
  'WithdrawStakeInstructionArgs'
)
/**
 * Accounts required by the _withdrawStake_ instruction
 *
 * @property [_writable_, **signer**] user
 * @property [_writable_] userAccount
 * @property [] cloneStaking
 * @property [] clnTokenMint
 * @property [_writable_] clnTokenVault
 * @property [_writable_] userClnTokenAccount
 * @category Instructions
 * @category WithdrawStake
 * @category generated
 */
export type WithdrawStakeInstructionAccounts = {
  user: web3.PublicKey
  userAccount: web3.PublicKey
  cloneStaking: web3.PublicKey
  clnTokenMint: web3.PublicKey
  clnTokenVault: web3.PublicKey
  userClnTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const withdrawStakeInstructionDiscriminator = [
  153, 8, 22, 138, 105, 176, 87, 66,
]

/**
 * Creates a _WithdrawStake_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category WithdrawStake
 * @category generated
 */
export function createWithdrawStakeInstruction(
  accounts: WithdrawStakeInstructionAccounts,
  args: WithdrawStakeInstructionArgs,
  programId = new web3.PublicKey('42L6bfEYntcmqVcFvHywitcaHhXF9rjYq9C9p9iWQ2X2')
) {
  const [data] = withdrawStakeStruct.serialize({
    instructionDiscriminator: withdrawStakeInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.user,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.userAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneStaking,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.clnTokenMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.clnTokenVault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userClnTokenAccount,
      isWritable: true,
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
