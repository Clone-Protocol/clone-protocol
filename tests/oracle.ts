import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { parsePriceData } from "@pythnetwork/client";
import { Pyth } from "../target/types/pyth";

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
  return parsePriceData(priceFeedInfo.data);
};
