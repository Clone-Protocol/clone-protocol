/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import * as beet from '@metaplex-foundation/beet'

/**
 * @category Instructions
 * @category InitializeIsolatedMarginUser
 * @category generated
 */
export type InitializeIsolatedMarginUserInstructionArgs = {
  authority: web3.PublicKey
}
/**
 * @category Instructions
 * @category InitializeIsolatedMarginUser
 * @category generated
 */
export const initializeIsolatedMarginUserStruct = new beet.BeetArgsStruct<
  InitializeIsolatedMarginUserInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['authority', beetSolana.publicKey],
  ],
  'InitializeIsolatedMarginUserInstructionArgs'
)
/**
 * Accounts required by the _initializeIsolatedMarginUser_ instruction
 *
 * @property [_writable_, **signer**] payer
 * @property [_writable_] userAccount
 * @category Instructions
 * @category InitializeIsolatedMarginUser
 * @category generated
 */
export type InitializeIsolatedMarginUserInstructionAccounts = {
  payer: web3.PublicKey
  userAccount: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const initializeIsolatedMarginUserInstructionDiscriminator = [
  179, 98, 14, 12, 72, 165, 114, 46,
]

/**
 * Creates a _InitializeIsolatedMarginUser_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category InitializeIsolatedMarginUser
 * @category generated
 */
export function createInitializeIsolatedMarginUserInstruction(
  accounts: InitializeIsolatedMarginUserInstructionAccounts,
  args: InitializeIsolatedMarginUserInstructionArgs,
  programId = new web3.PublicKey('C1onEW2kPetmHmwe74YC1ESx3LnFEpVau6g2pg4fHycr')
) {
  const [data] = initializeIsolatedMarginUserStruct.serialize({
    instructionDiscriminator:
      initializeIsolatedMarginUserInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.payer,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.userAccount,
      isWritable: true,
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
