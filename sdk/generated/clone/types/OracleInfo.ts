/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beet from '@metaplex-foundation/beet'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import { OracleSource, oracleSourceBeet } from './OracleSource'
import { Status, statusBeet } from './Status'
export type OracleInfo = {
  source: OracleSource
  address: web3.PublicKey
  price: beet.bignum
  expo: number
  status: Status
  lastUpdateSlot: beet.bignum
  rescaleFactor: number
}

/**
 * @category userTypes
 * @category generated
 */
export const oracleInfoBeet = new beet.BeetArgsStruct<OracleInfo>(
  [
    ['source', oracleSourceBeet],
    ['address', beetSolana.publicKey],
    ['price', beet.i64],
    ['expo', beet.u8],
    ['status', statusBeet],
    ['lastUpdateSlot', beet.u64],
    ['rescaleFactor', beet.u8],
  ],
  'OracleInfo'
)
