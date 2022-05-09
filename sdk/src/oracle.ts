import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { parsePriceData } from "@pythnetwork/client";
import { Pyth } from "./idl/pyth";
import { Store } from "./idl/store";

export class ChainLinkOracle {
  private priceFeed: anchor.web3.Keypair;
  private authority: anchor.web3.Keypair;
  program: Program<Store>;

  constructor(program: Program<Store>) {
    this.program = program;
    this.authority = anchor.web3.Keypair.generate();
    this.priceFeed = anchor.web3.Keypair.generate();
  }

  public priceFeedPubkey() {
    return this.priceFeed.publicKey;
  }

  public async createChainlinkFeed(
    granularity: number,
    historical_size: number
  ) {
    let header_plus_discriminator_size = 192 + 8;
    let struct_space = 48 * 2; // Taken from the Transmission size, double it since we store live and historical.
    let space = header_plus_discriminator_size + historical_size * struct_space;

    await this.program.rpc.createFeed(
      "chainlink feed",
      8,
      granularity,
      historical_size,
      {
        accounts: {
          feed: this.priceFeedPubkey(),
          authority: this.authority.publicKey,
        },
        signers: [this.authority, this.priceFeed],
        instructions: [
          anchor.web3.SystemProgram.createAccount({
            fromPubkey: this.program.provider.wallet.publicKey,
            newAccountPubkey: this.priceFeed.publicKey,
            space: space,
            lamports:
              await this.program.provider.connection.getMinimumBalanceForRentExemption(
                space
              ),
            programId: this.program.programId,
          }),
        ],
      }
    );

    await this.program.rpc.setWriter(this.authority.publicKey, {
      accounts: {
        feed: this.priceFeedPubkey(),
        owner: this.authority.publicKey,
        authority: this.authority.publicKey,
      },
      signers: [this.authority],
    });
  }

  public async submitAnswer(timestamp: BN, answer: BN) {
    await this.program.rpc.submit(
      { timestamp: timestamp, answer: answer },
      {
        accounts: {
          feed: this.priceFeedPubkey(),
          authority: this.authority.publicKey,
        },
        signers: [this.authority],
      }
    );
  }

}

export const createPriceFeed = async (
  pythProgram: Program<Pyth>,
  price: number,
  expo: number,
  conf: BN
) => {
  const priceFeed = anchor.web3.Keypair.generate();
  await pythProgram.rpc.initialize(new BN(price * 10 ** -expo), expo, conf, {
    accounts: { price: priceFeed.publicKey },
    signers: [priceFeed],
    instructions: [
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: pythProgram.provider.wallet.publicKey,
        newAccountPubkey: priceFeed.publicKey,
        space: 3312,
        lamports:
          await pythProgram.provider.connection.getMinimumBalanceForRentExemption(
            3312
          ),
        programId: pythProgram.programId,
      }),
    ],
  });

  return priceFeed.publicKey;
};

export const setPrice = async (
  pythProgram: Program<Pyth>,
  price: number,
  priceFeed: anchor.web3.PublicKey
) => {
  const priceFeedInfo = await pythProgram.provider.connection.getAccountInfo(
    priceFeed
  );
  if (priceFeedInfo === null) {
    throw new Error("Price feed info null!")
  }
  const data = parsePriceData(priceFeedInfo.data);
  await pythProgram.rpc.setPrice(new BN(price * 10 ** -data.exponent), {
    accounts: { price: priceFeed },
  });
};

export const getFeedData = async (
  pythProgram: Program<Pyth>,
  priceFeed: anchor.web3.PublicKey
) => {
  const priceFeedInfo = await pythProgram.provider.connection.getAccountInfo(
    priceFeed
  );
  if (priceFeedInfo === null) {
    throw new Error("Price feed info null!")
  }
  return parsePriceData(priceFeedInfo.data);
};
