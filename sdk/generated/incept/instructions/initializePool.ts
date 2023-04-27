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
 * @category InitializePool
 * @category generated
 */
export type InitializePoolInstructionArgs = {
  stableCollateralRatio: number
  cryptoCollateralRatio: number
  liquidityTradingFee: number
  treasuryTradingFee: number
  ilHealthScoreCoefficient: beet.bignum
  positionHealthScoreCoefficient: beet.bignum
  liquidationDiscountRate: beet.bignum
  maxOwnershipPct: beet.bignum
}
/**
 * @category Instructions
 * @category InitializePool
 * @category generated
 */
export const initializePoolStruct = new beet.BeetArgsStruct<
  InitializePoolInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['stableCollateralRatio', beet.u16],
    ['cryptoCollateralRatio', beet.u16],
    ['liquidityTradingFee', beet.u16],
    ['treasuryTradingFee', beet.u16],
    ['ilHealthScoreCoefficient', beet.u64],
    ['positionHealthScoreCoefficient', beet.u64],
    ['liquidationDiscountRate', beet.u64],
    ['maxOwnershipPct', beet.u64],
  ],
  'InitializePoolInstructionArgs'
)
/**
 * Accounts required by the _initializePool_ instruction
 *
 * @property [_writable_, **signer**] admin
 * @property [] incept
 * @property [_writable_] tokenData
 * @property [] usdiMint
 * @property [_writable_, **signer**] usdiTokenAccount
 * @property [_writable_, **signer**] iassetMint
 * @property [_writable_, **signer**] iassetTokenAccount
 * @property [] underlyingAssetMint
 * @property [_writable_, **signer**] underlyingAssetTokenAccount
 * @property [_writable_, **signer**] liquidityTokenMint
 * @property [_writable_, **signer**] cometLiquidityTokenAccount
 * @property [] pythOracle
 * @category Instructions
 * @category InitializePool
 * @category generated
 */
export type InitializePoolInstructionAccounts = {
  admin: web3.PublicKey
  incept: web3.PublicKey
  tokenData: web3.PublicKey
  usdiMint: web3.PublicKey
  usdiTokenAccount: web3.PublicKey
  iassetMint: web3.PublicKey
  iassetTokenAccount: web3.PublicKey
  underlyingAssetMint: web3.PublicKey
  underlyingAssetTokenAccount: web3.PublicKey
  liquidityTokenMint: web3.PublicKey
  cometLiquidityTokenAccount: web3.PublicKey
  pythOracle: web3.PublicKey
  rent?: web3.PublicKey
  tokenProgram?: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const initializePoolInstructionDiscriminator = [
  95, 180, 10, 172, 84, 174, 232, 40,
]

/**
 * Creates a _InitializePool_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category InitializePool
 * @category generated
 */
export function createInitializePoolInstruction(
  accounts: InitializePoolInstructionAccounts,
  args: InitializePoolInstructionArgs,
  programId = new web3.PublicKey('5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1')
) {
  const [data] = initializePoolStruct.serialize({
    instructionDiscriminator: initializePoolInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.admin,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.incept,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.tokenData,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.usdiMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.usdiTokenAccount,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.iassetMint,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.iassetTokenAccount,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.underlyingAssetMint,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.underlyingAssetTokenAccount,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.liquidityTokenMint,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.cometLiquidityTokenAccount,
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.pythOracle,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: accounts.rent ?? web3.SYSVAR_RENT_PUBKEY,
      isWritable: false,
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