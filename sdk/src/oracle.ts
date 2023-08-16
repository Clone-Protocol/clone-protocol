import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { parsePriceData } from "@pythnetwork/client";
import {
  createInitializeInstruction,
  createSetPriceInstruction,
} from "../generated/pyth";
import { PublicKey, Transaction } from "@solana/web3.js";
import { toScale } from "./clone";

export const createPriceFeed = async (
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  price: number,
  expo: number,
  priceFeed?: anchor.web3.Keypair
): Promise<anchor.web3.PublicKey> => {
  const kp = priceFeed ?? anchor.web3.Keypair.generate();

  let space = 3312;
  let tx = new Transaction().add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.publicKey!,
      newAccountPubkey: kp.publicKey,
      space,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(
        space
      ),
      programId: programId,
    }),
    createInitializeInstruction(
      {
        priceAccount: kp.publicKey,
      },
      {
        price: toScale(price, -expo),
        expo,
      },
      programId
    )
  );

  await provider.sendAndConfirm(tx, [kp]);

  return kp.publicKey;
};

export const setPrice = async (
  provider: anchor.AnchorProvider,
  price: number,
  priceFeed: anchor.web3.PublicKey
) => {
  const data = await getFeedData(provider, priceFeed);
  const priceUpdate = toScale(price, -data.exponent);

  let tx = new Transaction().add(
    createSetPriceInstruction(
      {
        priceAccount: priceFeed,
      },
      {
        price: priceUpdate,
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
