/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import * as beet from '@metaplex-foundation/beet'
import { RawDecimal, rawDecimalBeet } from './RawDecimal'
import { AssetInfo, assetInfoBeet } from './AssetInfo'
export type Pool = {
  iassetTokenAccount: web3.PublicKey
  usdiTokenAccount: web3.PublicKey
  liquidityTokenMint: web3.PublicKey
  underlyingAssetTokenAccount: web3.PublicKey
  cometLiquidityTokenAccount: web3.PublicKey
  iassetAmount: RawDecimal
  usdiAmount: RawDecimal
  liquidityTokenSupply: RawDecimal
  treasuryTradingFee: RawDecimal
  liquidityTradingFee: RawDecimal
  totalMintedAmount: RawDecimal
  suppliedMintCollateralAmount: RawDecimal
  assetInfo: AssetInfo
}

/**
 * @category userTypes
 * @category generated
 */
export const poolBeet = new beet.BeetArgsStruct<Pool>(
  [
    ['iassetTokenAccount', beetSolana.publicKey],
    ['usdiTokenAccount', beetSolana.publicKey],
    ['liquidityTokenMint', beetSolana.publicKey],
    ['underlyingAssetTokenAccount', beetSolana.publicKey],
    ['cometLiquidityTokenAccount', beetSolana.publicKey],
    ['iassetAmount', rawDecimalBeet],
    ['usdiAmount', rawDecimalBeet],
    ['liquidityTokenSupply', rawDecimalBeet],
    ['treasuryTradingFee', rawDecimalBeet],
    ['liquidityTradingFee', rawDecimalBeet],
    ['totalMintedAmount', rawDecimalBeet],
    ['suppliedMintCollateralAmount', rawDecimalBeet],
    ['assetInfo', assetInfoBeet],
  ],
  'Pool'
)