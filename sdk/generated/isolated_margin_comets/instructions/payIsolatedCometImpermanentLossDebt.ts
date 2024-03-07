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
import { PaymentType, paymentTypeBeet } from '../types/PaymentType'

/**
 * @category Instructions
 * @category PayIsolatedCometImpermanentLossDebt
 * @category generated
 */
export type PayIsolatedCometImpermanentLossDebtInstructionArgs = {
  owner: web3.PublicKey
  positionIndex: number
  amount: beet.bignum
  paymentType: PaymentType
}
/**
 * @category Instructions
 * @category PayIsolatedCometImpermanentLossDebt
 * @category generated
 */
export const payIsolatedCometImpermanentLossDebtStruct =
  new beet.BeetArgsStruct<
    PayIsolatedCometImpermanentLossDebtInstructionArgs & {
      instructionDiscriminator: number[] /* size: 8 */
    }
  >(
    [
      ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
      ['owner', beetSolana.publicKey],
      ['positionIndex', beet.u8],
      ['amount', beet.u64],
      ['paymentType', paymentTypeBeet],
    ],
    'PayIsolatedCometImpermanentLossDebtInstructionArgs'
  )
/**
 * Accounts required by the _payIsolatedCometImpermanentLossDebt_ instruction
 *
 * @property [_writable_, **signer**] payer
 * @property [] managerAccount
 * @property [] ownerAccount
 * @property [_writable_] userAccount
 * @property [] cloneProgram
 * @property [] cloneAccount
 * @property [] collateralMint
 * @property [] pools
 * @property [] onassetMint
 * @property [_writable_] payerCollateralTokenAccount
 * @property [_writable_] payerOnassetTokenAccount
 * @property [_writable_] vault
 * @category Instructions
 * @category PayIsolatedCometImpermanentLossDebt
 * @category generated
 */
export type PayIsolatedCometImpermanentLossDebtInstructionAccounts = {
  payer: web3.PublicKey
  managerAccount: web3.PublicKey
  ownerAccount: web3.PublicKey
  userAccount: web3.PublicKey
  cloneProgram: web3.PublicKey
  cloneAccount: web3.PublicKey
  collateralMint: web3.PublicKey
  pools: web3.PublicKey
  onassetMint: web3.PublicKey
  payerCollateralTokenAccount: web3.PublicKey
  payerOnassetTokenAccount: web3.PublicKey
  vault: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const payIsolatedCometImpermanentLossDebtInstructionDiscriminator = [
  80, 141, 38, 123, 74, 207, 47, 117,
]

/**
 * Creates a _PayIsolatedCometImpermanentLossDebt_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category PayIsolatedCometImpermanentLossDebt
 * @category generated
 */
export function createPayIsolatedCometImpermanentLossDebtInstruction(
  accounts: PayIsolatedCometImpermanentLossDebtInstructionAccounts,
  args: PayIsolatedCometImpermanentLossDebtInstructionArgs,
  programId = new web3.PublicKey('HeXLPMQr13eLB6k6rvX2phBg3ETpvzqMBnZxSZy9tvn3')
) {
  const [data] = payIsolatedCometImpermanentLossDebtStruct.serialize({
    instructionDiscriminator:
      payIsolatedCometImpermanentLossDebtInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.payer,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.managerAccount,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.ownerAccount,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.userAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneProgram,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneAccount,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.collateralMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.pools,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.onassetMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.payerCollateralTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.payerOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.vault,
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
