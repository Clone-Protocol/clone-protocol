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
 * @category ManagementFeeClaim
 * @category generated
 */
export const managementFeeClaimStruct = new beet.BeetArgsStruct<{
  instructionDiscriminator: number[] /* size: 8 */
}>(
  [['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)]],
  'ManagementFeeClaimInstructionArgs'
)
/**
 * Accounts required by the _managementFeeClaim_ instruction
 *
 * @property [**signer**] managerOwner
 * @property [_writable_] managerInfo
 * @property [_writable_] ownerAccount
 * @category Instructions
 * @category ManagementFeeClaim
 * @category generated
 */
export type ManagementFeeClaimInstructionAccounts = {
  managerOwner: web3.PublicKey
  managerInfo: web3.PublicKey
  ownerAccount: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const managementFeeClaimInstructionDiscriminator = [
  254, 117, 137, 162, 30, 250, 80, 58,
]

/**
 * Creates a _ManagementFeeClaim_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @category Instructions
 * @category ManagementFeeClaim
 * @category generated
 */
export function createManagementFeeClaimInstruction(
  accounts: ManagementFeeClaimInstructionAccounts,
  programId = new web3.PublicKey('CNEvgsmVcYBwUzWQj6iss9MJaFDAzpF8BHSEjejLTXDh')
) {
  const [data] = managementFeeClaimStruct.serialize({
    instructionDiscriminator: managementFeeClaimInstructionDiscriminator,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.managerOwner,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.managerInfo,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.ownerAccount,
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
