/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import * as beet from '@metaplex-foundation/beet'
import { RawDecimal, rawDecimalBeet } from '../types/RawDecimal'

/**
 * Arguments used to create {@link Jupiter}
 * @category Accounts
 * @category generated
 */
export type JupiterArgs = {
  usdcMint: web3.PublicKey
  assetMints: web3.PublicKey[] /* size: 10 */
  oracles: web3.PublicKey[] /* size: 10 */
  answer: RawDecimal
  nAssets: number
  bump: number
}

export const jupiterDiscriminator = [42, 239, 65, 52, 216, 143, 168, 209]
/**
 * Holds the data for the {@link Jupiter} Account and provides de/serialization
 * functionality for that data
 *
 * @category Accounts
 * @category generated
 */
export class Jupiter implements JupiterArgs {
  private constructor(
    readonly usdcMint: web3.PublicKey,
    readonly assetMints: web3.PublicKey[] /* size: 10 */,
    readonly oracles: web3.PublicKey[] /* size: 10 */,
    readonly answer: RawDecimal,
    readonly nAssets: number,
    readonly bump: number
  ) {}

  /**
   * Creates a {@link Jupiter} instance from the provided args.
   */
  static fromArgs(args: JupiterArgs) {
    return new Jupiter(
      args.usdcMint,
      args.assetMints,
      args.oracles,
      args.answer,
      args.nAssets,
      args.bump
    )
  }

  /**
   * Deserializes the {@link Jupiter} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(
    accountInfo: web3.AccountInfo<Buffer>,
    offset = 0
  ): [Jupiter, number] {
    return Jupiter.deserialize(accountInfo.data, offset)
  }

  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link Jupiter} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(
    connection: web3.Connection,
    address: web3.PublicKey,
    commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
  ): Promise<Jupiter> {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    )
    if (accountInfo == null) {
      throw new Error(`Unable to find Jupiter account at ${address}`)
    }
    return Jupiter.fromAccountInfo(accountInfo, 0)[0]
  }

  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(
    programId: web3.PublicKey = new web3.PublicKey(
      '4tChJFNsWLMyk81ezv8N8gKVb2q7H1akSQENn4NToSuS'
    )
  ) {
    return beetSolana.GpaBuilder.fromStruct(programId, jupiterBeet)
  }

  /**
   * Deserializes the {@link Jupiter} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf: Buffer, offset = 0): [Jupiter, number] {
    return jupiterBeet.deserialize(buf, offset)
  }

  /**
   * Serializes the {@link Jupiter} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize(): [Buffer, number] {
    return jupiterBeet.serialize({
      accountDiscriminator: jupiterDiscriminator,
      ...this,
    })
  }

  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link Jupiter}
   */
  static get byteSize() {
    return jupiterBeet.byteSize
  }

  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link Jupiter} data from rent
   *
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(
    connection: web3.Connection,
    commitment?: web3.Commitment
  ): Promise<number> {
    return connection.getMinimumBalanceForRentExemption(
      Jupiter.byteSize,
      commitment
    )
  }

  /**
   * Determines if the provided {@link Buffer} has the correct byte size to
   * hold {@link Jupiter} data.
   */
  static hasCorrectByteSize(buf: Buffer, offset = 0) {
    return buf.byteLength - offset === Jupiter.byteSize
  }

  /**
   * Returns a readable version of {@link Jupiter} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      usdcMint: this.usdcMint.toBase58(),
      assetMints: this.assetMints,
      oracles: this.oracles,
      answer: this.answer,
      nAssets: this.nAssets,
      bump: this.bump,
    }
  }
}

/**
 * @category Accounts
 * @category generated
 */
export const jupiterBeet = new beet.BeetStruct<
  Jupiter,
  JupiterArgs & {
    accountDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['accountDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['usdcMint', beetSolana.publicKey],
    ['assetMints', beet.uniformFixedSizeArray(beetSolana.publicKey, 10)],
    ['oracles', beet.uniformFixedSizeArray(beetSolana.publicKey, 10)],
    ['answer', rawDecimalBeet],
    ['nAssets', beet.u8],
    ['bump', beet.u8],
  ],
  Jupiter.fromArgs,
  'Jupiter'
)