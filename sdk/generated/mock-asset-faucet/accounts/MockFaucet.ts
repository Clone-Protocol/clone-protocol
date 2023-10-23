/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import * as beet from '@metaplex-foundation/beet'

/**
 * Arguments used to create {@link MockFaucet}
 * @category Accounts
 * @category generated
 */
export type MockFaucetArgs = {
  mint: web3.PublicKey
}

export const mockFaucetDiscriminator = [240, 194, 165, 30, 237, 205, 24, 218]
/**
 * Holds the data for the {@link MockFaucet} Account and provides de/serialization
 * functionality for that data
 *
 * @category Accounts
 * @category generated
 */
export class MockFaucet implements MockFaucetArgs {
  private constructor(readonly mint: web3.PublicKey) {}

  /**
   * Creates a {@link MockFaucet} instance from the provided args.
   */
  static fromArgs(args: MockFaucetArgs) {
    return new MockFaucet(args.mint)
  }

  /**
   * Deserializes the {@link MockFaucet} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(
    accountInfo: web3.AccountInfo<Buffer>,
    offset = 0
  ): [MockFaucet, number] {
    return MockFaucet.deserialize(accountInfo.data, offset)
  }

  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link MockFaucet} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(
    connection: web3.Connection,
    address: web3.PublicKey,
    commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
  ): Promise<MockFaucet> {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    )
    if (accountInfo == null) {
      throw new Error(`Unable to find MockFaucet account at ${address}`)
    }
    return MockFaucet.fromAccountInfo(accountInfo, 0)[0]
  }

  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(
    programId: web3.PublicKey = new web3.PublicKey(
      '7EtBBf3vKfP2m8mc6TwvQEKpBqfJgbH9VNhZ7kHeFTMP'
    )
  ) {
    return beetSolana.GpaBuilder.fromStruct(programId, mockFaucetBeet)
  }

  /**
   * Deserializes the {@link MockFaucet} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf: Buffer, offset = 0): [MockFaucet, number] {
    return mockFaucetBeet.deserialize(buf, offset)
  }

  /**
   * Serializes the {@link MockFaucet} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize(): [Buffer, number] {
    return mockFaucetBeet.serialize({
      accountDiscriminator: mockFaucetDiscriminator,
      ...this,
    })
  }

  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link MockFaucet}
   */
  static get byteSize() {
    return mockFaucetBeet.byteSize
  }

  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link MockFaucet} data from rent
   *
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(
    connection: web3.Connection,
    commitment?: web3.Commitment
  ): Promise<number> {
    return connection.getMinimumBalanceForRentExemption(
      MockFaucet.byteSize,
      commitment
    )
  }

  /**
   * Determines if the provided {@link Buffer} has the correct byte size to
   * hold {@link MockFaucet} data.
   */
  static hasCorrectByteSize(buf: Buffer, offset = 0) {
    return buf.byteLength - offset === MockFaucet.byteSize
  }

  /**
   * Returns a readable version of {@link MockFaucet} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      mint: this.mint.toBase58(),
    }
  }
}

/**
 * @category Accounts
 * @category generated
 */
export const mockFaucetBeet = new beet.BeetStruct<
  MockFaucet,
  MockFaucetArgs & {
    accountDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['accountDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['mint', beetSolana.publicKey],
  ],
  MockFaucet.fromArgs,
  'MockFaucet'
)