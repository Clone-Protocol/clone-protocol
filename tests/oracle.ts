import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { parsePriceData } from "@pythnetwork/client";
import { Pyth } from "../sdk/src/idl/pyth";

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
        fromPubkey: pythProgram.provider.publicKey!,
        newAccountPubkey: priceFeed.publicKey,
        space: 3312,
        lamports: await pythProgram.provider.connection.getMinimumBalanceForRentExemption(
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
  const data = parsePriceData(priceFeedInfo!.data);
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
  return parsePriceData(priceFeedInfo!.data);
};
