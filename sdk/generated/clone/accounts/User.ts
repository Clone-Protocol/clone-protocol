/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import { Borrow, borrowBeet } from '../types/Borrow'
import { Comet, cometBeet } from '../types/Comet'

/**
 * Arguments used to create {@link User}
 * @category Accounts
 * @category generated
 */
export type UserArgs = {
  borrows: Borrow[]
  comet: Comet
}

export const userDiscriminator = [159, 117, 95, 227, 239, 151, 58, 236]
/**
 * Holds the data for the {@link User} Account and provides de/serialization
 * functionality for that data
 *
 * @category Accounts
 * @category generated
 */
export class User implements UserArgs {
  private constructor(readonly borrows: Borrow[], readonly comet: Comet) {}

  /**
   * Creates a {@link User} instance from the provided args.
   */
  static fromArgs(args: UserArgs) {
    return new User(args.borrows, args.comet)
  }

  /**
   * Deserializes the {@link User} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(
    accountInfo: web3.AccountInfo<Buffer>,
    offset = 0
  ): [User, number] {
    return User.deserialize(accountInfo.data, offset)
  }

  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link User} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(
    connection: web3.Connection,
    address: web3.PublicKey,
    commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
  ): Promise<User> {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    )
    if (accountInfo == null) {
      throw new Error(`Unable to find User account at ${address}`)
    }
    return User.fromAccountInfo(accountInfo, 0)[0]
  }

  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(
    programId: web3.PublicKey = new web3.PublicKey(
      'F7KEvEhxAQ5AXKRSRHruSF55jcUxVv6S45ohkHvStd5v'
    )
  ) {
    return beetSolana.GpaBuilder.fromStruct(programId, userBeet)
  }

  /**
   * Deserializes the {@link User} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf: Buffer, offset = 0): [User, number] {
    return userBeet.deserialize(buf, offset)
  }

  /**
   * Serializes the {@link User} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize(): [Buffer, number] {
    return userBeet.serialize({
      accountDiscriminator: userDiscriminator,
      ...this,
    })
  }

  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link User} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args: UserArgs) {
    const instance = User.fromArgs(args)
    return userBeet.toFixedFromValue({
      accountDiscriminator: userDiscriminator,
      ...instance,
    }).byteSize
  }

  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link User} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(
    args: UserArgs,
    connection: web3.Connection,
    commitment?: web3.Commitment
  ): Promise<number> {
    return connection.getMinimumBalanceForRentExemption(
      User.byteSize(args),
      commitment
    )
  }

  /**
   * Returns a readable version of {@link User} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      borrows: this.borrows,
      comet: this.comet,
    }
  }
}

/**
 * @category Accounts
 * @category generated
 */
export const userBeet = new beet.FixableBeetStruct<
  User,
  UserArgs & {
    accountDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['accountDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['borrows', beet.array(borrowBeet)],
    ['comet', cometBeet],
  ],
  User.fromArgs,
  'User'
)
