/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import { LiquidityPosition, liquidityPositionBeet } from './LiquidityPosition'
export type Comet = {
  collateralAmount: beet.bignum
  positions: LiquidityPosition[]
}

/**
 * @category userTypes
 * @category generated
 */
export const cometBeet = new beet.FixableBeetArgsStruct<Comet>(
  [
    ['collateralAmount', beet.u64],
    ['positions', beet.array(liquidityPositionBeet)],
  ],
  'Comet'
)
