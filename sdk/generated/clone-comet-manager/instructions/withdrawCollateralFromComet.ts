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
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export type WithdrawCollateralFromCometInstructionArgs = {
  amount: beet.bignum
}
/**
 * @category Instructions
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export const withdrawCollateralFromCometStruct = new beet.BeetArgsStruct<
  WithdrawCollateralFromCometInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['amount', beet.u64],
  ],
  'WithdrawCollateralFromCometInstructionArgs'
)
/**
 * Accounts required by the _withdrawCollateralFromComet_ instruction
 *
 * @property [**signer**] signer
 * @property [_writable_] managerInfo
 * @property [_writable_] clone
 * @property [_writable_] managerCloneUser
 * @property [_writable_] onusdMint
 * @property [_writable_] managerOnusdTokenAccount
 * @property [] cloneProgram
 * @property [_writable_] comet
 * @property [_writable_] tokenData
 * @property [_writable_] cloneOnusdVault
 * @category Instructions
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export type WithdrawCollateralFromCometInstructionAccounts = {
  signer: web3.PublicKey
  managerInfo: web3.PublicKey
  clone: web3.PublicKey
  managerCloneUser: web3.PublicKey
  onusdMint: web3.PublicKey
  managerOnusdTokenAccount: web3.PublicKey
  cloneProgram: web3.PublicKey
  comet: web3.PublicKey
  tokenData: web3.PublicKey
  cloneOnusdVault: web3.PublicKey
  tokenProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const withdrawCollateralFromCometInstructionDiscriminator = [
  208, 162, 137, 187, 186, 161, 87, 136,
]

/**
 * Creates a _WithdrawCollateralFromComet_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category WithdrawCollateralFromComet
 * @category generated
 */
export function createWithdrawCollateralFromCometInstruction(
  accounts: WithdrawCollateralFromCometInstructionAccounts,
  args: WithdrawCollateralFromCometInstructionArgs,
  programId = new web3.PublicKey('HX81GDFSZ9GktdpQCg8N1sBRr1AydZMnkpkNw7dffQym')
) {
  const [data] = withdrawCollateralFromCometStruct.serialize({
    instructionDiscriminator:
      withdrawCollateralFromCometInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.signer,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.managerInfo,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.clone,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.managerCloneUser,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.onusdMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.managerOnusdTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneProgram,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.comet,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenData,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneOnusdVault,
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