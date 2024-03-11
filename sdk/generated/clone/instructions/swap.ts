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
 * @category Swap
 * @category generated
 */
export type SwapInstructionArgs = {
  poolIndex: number
  quantity: beet.bignum
  quantityIsInput: boolean
  quantityIsCollateral: boolean
  resultThreshold: beet.bignum
}
/**
 * @category Instructions
 * @category Swap
 * @category generated
 */
export const swapStruct = new beet.BeetArgsStruct<
  SwapInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['poolIndex', beet.u8],
    ['quantity', beet.u64],
    ['quantityIsInput', beet.bool],
    ['quantityIsCollateral', beet.bool],
    ['resultThreshold', beet.u64],
  ],
  'SwapInstructionArgs'
)
/**
 * Accounts required by the _swap_ instruction
 *
 * @property [**signer**] user
 * @property [_writable_] clone
 * @property [_writable_] pools
 * @property [_writable_] oracles
 * @property [_writable_] userCollateralTokenAccount
 * @property [_writable_] userOnassetTokenAccount
 * @property [_writable_] onassetMint
 * @property [_writable_] collateralMint
 * @property [_writable_] collateralVault
 * @property [_writable_] treasuryOnassetTokenAccount
 * @property [_writable_] treasuryCollateralTokenAccount
 * @property [] cloneStaking (optional)
 * @property [] userStakingAccount (optional)
 * @property [] cloneStakingProgram (optional)
 * @category Instructions
 * @category Swap
 * @category generated
 */
export type SwapInstructionAccounts = {
  user: web3.PublicKey
  clone: web3.PublicKey
  pools: web3.PublicKey
  oracles: web3.PublicKey
  userCollateralTokenAccount: web3.PublicKey
  userOnassetTokenAccount: web3.PublicKey
  onassetMint: web3.PublicKey
  collateralMint: web3.PublicKey
  collateralVault: web3.PublicKey
  treasuryOnassetTokenAccount: web3.PublicKey
  treasuryCollateralTokenAccount: web3.PublicKey
  tokenProgram?: web3.PublicKey
  cloneStaking?: web3.PublicKey
  userStakingAccount?: web3.PublicKey
  cloneStakingProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const swapInstructionDiscriminator = [
  248, 198, 158, 145, 225, 117, 135, 200,
]

/**
 * Creates a _Swap_ instruction.
 *
 * Optional accounts that are not provided default to the program ID since
 * this was indicated in the IDL from which this instruction was generated.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category Swap
 * @category generated
 */
export function createSwapInstruction(
  accounts: SwapInstructionAccounts,
  args: SwapInstructionArgs,
  programId = new web3.PublicKey('C1onEW2kPetmHmwe74YC1ESx3LnFEpVau6g2pg4fHycr')
) {
  const [data] = swapStruct.serialize({
    instructionDiscriminator: swapInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.user,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.clone,
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
    {
      pubkey: accounts.userCollateralTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.userOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.onassetMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.collateralMint,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.collateralVault,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.treasuryOnassetTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.treasuryCollateralTokenAccount,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenProgram ?? splToken.TOKEN_PROGRAM_ID,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneStaking ?? programId,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.userStakingAccount ?? programId,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.cloneStakingProgram ?? programId,
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
