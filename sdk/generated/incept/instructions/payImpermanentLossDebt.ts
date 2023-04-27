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
 * @category PayImpermanentLossDebt
 * @category generated
 */
export type PayImpermanentLossDebtInstructionArgs = {
  cometPositionIndex: number
  amount: beet.bignum
  payUsdiDebt: boolean
}
/**
 * @category Instructions
 * @category PayImpermanentLossDebt
 * @category generated
 */
export const payImpermanentLossDebtStruct = new beet.BeetArgsStruct<
  PayImpermanentLossDebtInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['cometPositionIndex', beet.u8],
    ['amount', beet.u64],
    ['payUsdiDebt', beet.bool],
  ],
  'PayImpermanentLossDebtInstructionArgs'
)
/**
 * Accounts required by the _payImpermanentLossDebt_ instruction
 *
 * @property [**signer**] user
 * @property [] userAccount
 * @property [_writable_] incept
 * @property [] tokenData
 * @property [_writable_] comet
 * @property [_writable_] usdiMint
 * @property [_writable_] iassetMint
 * @property [_writable_] userUsdiTokenAccount
 * @property [_writable_] userIassetTokenAccount
 * @property [_writable_] ammUsdiTokenAccount
 * @property [_writable_] ammIassetTokenAccount
 * @category Instructions
 * @category PayImpermanentLossDebt
 * @category generated
 */
export type PayImpermanentLossDebtInstructionAccounts = {
  user: web3.PublicKey
  userAccount: web3.PublicKey
  incept: web3.PublicKey
  tokenData: web3.PublicKey
  comet: web3.PublicKey
  usdiMint: web3.PublicKey
  iassetMint: web3.PublicKey
  userUsdiTokenAccount: web3.PublicKey
  userIassetTokenAccount: web3.PublicKey
  ammUsdiTokenAccount: web3.PublicKey
  ammIassetTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const payImpermanentLossDebtInstructionDiscriminator = [
  80, 181, 183, 177, 8, 170, 1, 70,
]

/**
 * Creates a _PayImpermanentLossDebt_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category PayImpermanentLossDebt
 * @category generated
 */
export function createPayImpermanentLossDebtInstruction(
  accounts: PayImpermanentLossDebtInstructionAccounts,
  args: PayImpermanentLossDebtInstructionArgs,
  programId = new web3.PublicKey('5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1')
) {
  const [data] = payImpermanentLossDebtStruct.serialize({
    instructionDiscriminator: payImpermanentLossDebtInstructionDiscriminator,
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
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.comet,
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
      pubkey: accounts.userUsdiTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userIassetTokenAccount,
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