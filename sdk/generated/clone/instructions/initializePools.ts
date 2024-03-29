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
 * @category InitializePools
 * @category generated
 */
export const initializePoolsStruct = new beet.BeetArgsStruct<{
  instructionDiscriminator: number[] /* size: 8 */
}>(
  [['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)]],
  'InitializePoolsInstructionArgs'
)
/**
 * Accounts required by the _initializePools_ instruction
 *
 * @property [_writable_, **signer**] admin
 * @property [] clone
 * @property [_writable_] pools
 * @category Instructions
 * @category InitializePools
 * @category generated
 */
export type InitializePoolsInstructionAccounts = {
  admin: web3.PublicKey
  clone: web3.PublicKey
  pools: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const initializePoolsInstructionDiscriminator = [
  48, 75, 127, 251, 17, 111, 153, 216,
]

/**
 * Creates a _InitializePools_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @category Instructions
 * @category InitializePools
 * @category generated
 */
export function createInitializePoolsInstruction(
  accounts: InitializePoolsInstructionAccounts,
  programId = new web3.PublicKey('C1onEW2kPetmHmwe74YC1ESx3LnFEpVau6g2pg4fHycr')
) {
  const [data] = initializePoolsStruct.serialize({
    instructionDiscriminator: initializePoolsInstructionDiscriminator,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.admin,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.clone,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.pools,
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
