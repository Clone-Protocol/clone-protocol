import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { parsePriceData } from "@pythnetwork/client";
import {
  createInitializeInstruction,
  createSetPriceInstruction,
} from "../generated/pyth";
import { PublicKey, Transaction } from "@solana/web3.js";

export const createPriceFeed = async (
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  price: number,
  expo: number,
  conf: BN
): Promise<PublicKey> => {
  const priceFeed = anchor.web3.Keypair.generate();

  let space = 3312;
  let tx = new Transaction().add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.publicKey!,
      newAccountPubkey: priceFeed.publicKey,
      space,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(
        space
      ),
      programId: programId,
    }),
    createInitializeInstruction(
      {
        price: priceFeed.publicKey,
      },
      {
        price: new BN(price * 10 ** -expo),
        expo,
        conf,
      }
    )
  );

  await provider.sendAndConfirm(tx, [priceFeed]);

  return priceFeed.publicKey;
};

export const setPrice = async (
  //pythProgram: any,
  provider: anchor.AnchorProvider,
  price: number,
  priceFeed: anchor.web3.PublicKey
) => {
  const priceFeedInfo = await provider.connection.getAccountInfo(priceFeed);
  if (priceFeedInfo === null) {
    throw new Error("Price feed info null!");
  }
  const data = parsePriceData(priceFeedInfo.data);
  let tx = new Transaction().add(
    createSetPriceInstruction(
      {
        price: priceFeed,
      },
      {
        price: new BN(price * 10 ** -data.exponent),
      }
    )
  );
  await provider.sendAndConfirm(tx);
};

export const getFeedData = async (
  provider: anchor.AnchorProvider,
  priceFeed: anchor.web3.PublicKey
) => {
  const priceFeedInfo = await provider.connection.getAccountInfo(priceFeed);
  if (priceFeedInfo === null) {
    throw new Error("Price feed info null!");
  }
  return parsePriceData(priceFeedInfo.data);
};
