/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beet from '@metaplex-foundation/beet'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import { CometPosition, cometPositionBeet } from '../types/CometPosition'
import { CometCollateral, cometCollateralBeet } from '../types/CometCollateral'

/**
 * Arguments used to create {@link Comet}
 * @category Accounts
 * @category generated
 */
export type CometArgs = {
  owner: web3.PublicKey
  numPositions: beet.bignum
  numCollaterals: beet.bignum
  positions: CometPosition[] /* size: 255 */
  collaterals: CometCollateral[] /* size: 255 */
}

export const cometDiscriminator = [162, 250, 25, 138, 55, 105, 60, 199]
/**
 * Holds the data for the {@link Comet} Account and provides de/serialization
 * functionality for that data
 *
 * @category Accounts
 * @category generated
 */
export class Comet implements CometArgs {
  private constructor(
    readonly owner: web3.PublicKey,
    readonly numPositions: beet.bignum,
    readonly numCollaterals: beet.bignum,
    readonly positions: CometPosition[] /* size: 255 */,
    readonly collaterals: CometCollateral[] /* size: 255 */
  ) {}

  /**
   * Creates a {@link Comet} instance from the provided args.
   */
  static fromArgs(args: CometArgs) {
    return new Comet(
      args.owner,
      args.numPositions,
      args.numCollaterals,
      args.positions,
      args.collaterals
    )
  }

  /**
   * Deserializes the {@link Comet} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(
    accountInfo: web3.AccountInfo<Buffer>,
    offset = 0
  ): [Comet, number] {
    return Comet.deserialize(accountInfo.data, offset)
  }

  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link Comet} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(
    connection: web3.Connection,
    address: web3.PublicKey,
    commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
  ): Promise<Comet> {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    )
    if (accountInfo == null) {
      throw new Error(`Unable to find Comet account at ${address}`)
    }
    return Comet.fromAccountInfo(accountInfo, 0)[0]
  }

  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(
    programId: web3.PublicKey = new web3.PublicKey(
      'BxUeKSA62ME4uZZH5gJ3p3co47D8RiZzdLwZSyNgs4sJ'
    )
  ) {
    return beetSolana.GpaBuilder.fromStruct(programId, cometBeet)
  }

  /**
   * Deserializes the {@link Comet} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf: Buffer, offset = 0): [Comet, number] {
    return cometBeet.deserialize(buf, offset)
  }

  /**
   * Serializes the {@link Comet} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize(): [Buffer, number] {
    return cometBeet.serialize({
      accountDiscriminator: cometDiscriminator,
      ...this,
    })
  }

  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link Comet}
   */
  static get byteSize() {
    return cometBeet.byteSize
  }

  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link Comet} data from rent
   *
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(
    connection: web3.Connection,
    commitment?: web3.Commitment
  ): Promise<number> {
    return connection.getMinimumBalanceForRentExemption(
      Comet.byteSize,
      commitment
    )
  }

  /**
   * Determines if the provided {@link Buffer} has the correct byte size to
   * hold {@link Comet} data.
   */
  static hasCorrectByteSize(buf: Buffer, offset = 0) {
    return buf.byteLength - offset === Comet.byteSize
  }

  /**
   * Returns a readable version of {@link Comet} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      owner: this.owner.toBase58(),
      numPositions: (() => {
        const x = <{ toNumber: () => number }>this.numPositions
        if (typeof x.toNumber === 'function') {
          try {
            return x.toNumber()
          } catch (_) {
            return x
          }
        }
        return x
      })(),
      numCollaterals: (() => {
        const x = <{ toNumber: () => number }>this.numCollaterals
        if (typeof x.toNumber === 'function') {
          try {
            return x.toNumber()
          } catch (_) {
            return x
          }
        }
        return x
      })(),
      positions: this.positions,
      collaterals: this.collaterals,
    }
  }
}

/**
 * @category Accounts
 * @category generated
 */
export const cometBeet = new beet.BeetStruct<
  Comet,
  CometArgs & {
    accountDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['accountDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['owner', beetSolana.publicKey],
    ['numPositions', beet.u64],
    ['numCollaterals', beet.u64],
    ['positions', beet.uniformFixedSizeArray(cometPositionBeet, 255)],
    ['collaterals', beet.uniformFixedSizeArray(cometCollateralBeet, 255)],
  ],
  Comet.fromArgs,
  'Comet'
)
