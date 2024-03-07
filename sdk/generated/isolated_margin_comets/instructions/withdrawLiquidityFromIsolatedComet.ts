/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'

/**
 * @category Instructions
 * @category WithdrawLiquidityFromIsolatedComet
 * @category generated
 */
export type WithdrawLiquidityFromIsolatedCometInstructionArgs = {
  positionIndex: number
  amount: beet.bignum
}
/**
 * @category Instructions
 * @category WithdrawLiquidityFromIsolatedComet
 * @category generated
 */
export const withdrawLiquidityFromIsolatedCometStruct = new beet.BeetArgsStruct<
  WithdrawLiquidityFromIsolatedCometInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['positionIndex', beet.u8],
    ['amount', beet.u64],
  ],
  'WithdrawLiquidityFromIsolatedCometInstructionArgs'
)
/**
 * Accounts required by the _withdrawLiquidityFromIsolatedComet_ instruction
 *
 * @property [_writable_, **signer**] signer
 * @property [] managerAccount
 * @property [] ownerAccount
 * @property [_writable_] userAccount
 * @property [] cloneProgram
 * @property [_writable_] cloneAccount
 * @property [_writable_] pools
 * @property [_writable_] oracles
 * @category Instructions
 * @category WithdrawLiquidityFromIsolatedComet
 * @category generated
 */
export type WithdrawLiquidityFromIsolatedCometInstructionAccounts = {
  signer: web3.PublicKey
  managerAccount: web3.PublicKey
  ownerAccount: web3.PublicKey
  userAccount: web3.PublicKey
  cloneProgram: web3.PublicKey
  cloneAccount: web3.PublicKey
  pools: web3.PublicKey
  oracles: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const withdrawLiquidityFromIsolatedCometInstructionDiscriminator = [
  189, 102, 120, 83, 101, 193, 167, 187,
]

/**
 * Creates a _WithdrawLiquidityFromIsolatedComet_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category WithdrawLiquidityFromIsolatedComet
 * @category generated
 */
export function createWithdrawLiquidityFromIsolatedCometInstruction(
  accounts: WithdrawLiquidityFromIsolatedCometInstructionAccounts,
  args: WithdrawLiquidityFromIsolatedCometInstructionArgs,
  programId = new web3.PublicKey('HeXLPMQr13eLB6k6rvX2phBg3ETpvzqMBnZxSZy9tvn3')
) {
  const [data] = withdrawLiquidityFromIsolatedCometStruct.serialize({
    instructionDiscriminator:
      withdrawLiquidityFromIsolatedCometInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.signer,
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
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.pools,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.oracles,
      isWritable: true,
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
