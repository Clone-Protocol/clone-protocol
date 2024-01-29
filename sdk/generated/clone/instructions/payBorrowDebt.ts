/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as splToken from '@solana/spl-token'
import * as web3 from '@solana/web3.js'
import * as beet from '@metaplex-foundation/beet'
import * as beetSolana from '@metaplex-foundation/beet-solana'

/**
 * @category Instructions
 * @category PayBorrowDebt
 * @category generated
 */
export type PayBorrowDebtInstructionArgs = {
  user: web3.PublicKey
  borrowIndex: number
  amount: beet.bignum
}
/**
 * @category Instructions
 * @category PayBorrowDebt
 * @category generated
 */
export const payBorrowDebtStruct = new beet.BeetArgsStruct<
  PayBorrowDebtInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['user', beetSolana.publicKey],
    ['borrowIndex', beet.u8],
    ['amount', beet.u64],
  ],
  'PayBorrowDebtInstructionArgs'
)
/**
 * Accounts required by the _payBorrowDebt_ instruction
 *
 * @property [**signer**] payer
 * @property [_writable_] userAccount
 * @property [_writable_] clone
 * @property [] pools
 * @property [_writable_] payerOnassetTokenAccount
 * @property [_writable_] onassetMint
 * @category Instructions
 * @category PayBorrowDebt
 * @category generated
 */
export type PayBorrowDebtInstructionAccounts = {
  payer: web3.PublicKey
  userAccount: web3.PublicKey
  clone: web3.PublicKey
  pools: web3.PublicKey
  payerOnassetTokenAccount: web3.PublicKey
  onassetMint: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const payBorrowDebtInstructionDiscriminator = [
  182, 215, 36, 35, 119, 58, 60, 200,
]

/**
 * Creates a _PayBorrowDebt_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category PayBorrowDebt
 * @category generated
 */
export function createPayBorrowDebtInstruction(
  accounts: PayBorrowDebtInstructionAccounts,
  args: PayBorrowDebtInstructionArgs,
  programId = new web3.PublicKey('C1onEW2kPetmHmwe74YC1ESx3LnFEpVau6g2pg4fHycr')
) {
  const [data] = payBorrowDebtStruct.serialize({
    instructionDiscriminator: payBorrowDebtInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.payer,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.userAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.clone,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.pools,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.payerOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.onassetMint,
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
