import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { parsePriceData } from "@pythnetwork/client";

export const createPriceFeed = async (
  pythProgram: Program,
  price: number,
  expo: number,
  conf: number
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
  pythProgram: Program,
  price: number,
  priceFeed: anchor.web3.PublicKey
) => {
  const priceFeedInfo = await pythProgram.provider.connection.getAccountInfo(
    priceFeed
  );
  //@ts-expect-error
  const data = parsePriceData(priceFeedInfo.data);
  await pythProgram.rpc.setPrice(new BN(price * 10 ** -data.exponent), {
    accounts: { price: priceFeed },
  });
};

export const getFeedData = async (
  pythProgram: Program,
  priceFeed: anchor.web3.PublicKey
) => {
  const priceFeedInfo = await pythProgram.provider.connection.getAccountInfo(
    priceFeed
  );
  //@ts-expect-error
  return parsePriceData(priceFeedInfo.data);
};
