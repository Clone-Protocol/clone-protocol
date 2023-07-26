import os from "os";
import toml from "toml";
import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  Account,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  JupiterAggMock,
  IDL as mockJupIDL,
} from "../sdk/src/idl/jupiter_agg_mock";
import { Clone, IDL as cloneIDL } from "../sdk/src/idl/clone";
import { Pyth, IDL as pythIDL } from "../sdk/src/idl/pyth";
import { Provider, BN } from "@coral-xyz/anchor";
import { Decimal } from "../sdk/src/decimal";
import { CLONE_TOKEN_SCALE, toDevnetScale } from "../sdk/src/clone";

const chalk = require("chalk");

export function anchorSetup() {
  // Read the network and wallet from the config file
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  const network = config.network;
  let wallet = config.wallet;
  let provider: anchor.AnchorProvider;

  if (!wallet) {
    const anchorConfig = toml.parse(fs.readFileSync("./Anchor.toml", "utf-8"));
    const homeDir = os.homedir();
    wallet = anchorConfig.provider.wallet.replace("~", homeDir);

    process.env.ANCHOR_WALLET = wallet;

    provider = anchor.AnchorProvider.local();
  } else {
    const walletKeyPair = JSON.parse(fs.readFileSync(wallet, "utf8"));

    const walletInstance = new anchor.Wallet(walletKeyPair);

    provider = new anchor.AnchorProvider(
      new anchor.web3.Connection(network),
      walletInstance,
      anchor.AnchorProvider.defaultOptions()
    );
  }

  anchor.setProvider(provider);

  return { network: network, provider: provider };
}

export function getCloneProgram(provider: anchor.AnchorProvider) {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const cloneProgramId = new PublicKey(config.clone);

  return new Program<Clone>(cloneIDL, cloneProgramId, provider);
}

export function getMockJupiterProgram(provider: anchor.AnchorProvider) {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const mockJupProgramId = new PublicKey(config.jup);

  return new Program<JupiterAggMock>(mockJupIDL, mockJupProgramId, provider);
}

export function getPythProgram(provider: anchor.AnchorProvider) {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const pythProgramId = new PublicKey(config.pyth);

  return new Program<Pyth>(pythIDL, pythProgramId, provider);
}

export async function getUSDC() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  return new PublicKey(config.usdc);
}

export async function getMockAssetMint(
  provider: anchor.AnchorProvider,
  index: number
) {
  const jupiterProgram = getMockJupiterProgram(provider);
  let [jupiterAddress, _] = await PublicKey.findProgramAddress(
    [anchor.utils.bytes.utf8.encode("jupiter")],
    jupiterProgram.programId
  );
  const assetMint = (await jupiterProgram.account.jupiter.fetch(jupiterAddress))
    .assetMints[index];

  return assetMint;
}

export async function getAssetPriceFeed(
  provider: anchor.AnchorProvider,
  index: number
) {
  //not yet implemented

  return "";
}

export async function getMockAssetPriceFeed(
  network: string,
  provider: anchor.AnchorProvider,
  index: number
) {
  const jupiterProgram = getMockJupiterProgram(provider);
  let [jupiterAddress, _] = await PublicKey.findProgramAddress(
    [anchor.utils.bytes.utf8.encode("jupiter")],
    jupiterProgram.programId
  );
  const priceFeed = (await jupiterProgram.account.jupiter.fetch(jupiterAddress))
    .oracles[index];

  return priceFeed;
}

export const getOrCreateAssociatedTokenAccount = async (
  provider: Provider,
  mint: PublicKey,
  owner?: PublicKey,
  ownerOffCurve?: boolean
): Promise<Account> => {
  const associatedToken = await getAssociatedTokenAddress(
    mint,
    owner !== undefined ? owner : provider.publicKey!,
    ownerOffCurve !== undefined ? ownerOffCurve : false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  let account: Account;
  try {
    account = await getAccount(
      provider.connection,
      associatedToken,
      "recent",
      TOKEN_PROGRAM_ID
    );
  } catch (error: unknown) {
    if (error instanceof TokenAccountNotFoundError) {
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey!,
          associatedToken,
          owner ? owner : provider.publicKey!,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      await provider.sendAndConfirm!(transaction);
      await sleep(6000);
      account = await getAccount(
        provider.connection,
        associatedToken,
        "recent",
        TOKEN_PROGRAM_ID
      );
    } else {
      throw error;
    }
  }

  if (!account) {
    throw Error("Could not create account!");
  }
  return account;
};

export const getStatus = (num: number) => {
  let status: string;

  switch (num) {
    case 0:
      status = "Active";
      break;
    case 1:
      status = "Frozen";
      break;
    case 2:
      status = "Extraction";
      break;
    case 3:
      status = "Liquidation";
      break;
    case 4:
      status = "Deprecation";
      break;
    default:
      status = "Unknown";
  }

  return status;
};

export const convertToRawDecimal = (num: number) => {
  let temp = new Decimal(
    BigInt(toDevnetScale(num).toNumber()),
    BigInt(CLONE_TOKEN_SCALE)
  );
  return temp.toRawDecimal();
};

export const fromDevnetScale = (x: number): number => {
  const scale = Math.pow(10, CLONE_TOKEN_SCALE);
  return x / scale;
};

export function successLog(message: string) {
  console.log(chalk.greenBright.bold("✨ Success:"), message);
}

export function errorLog(message: string) {
  console.error(chalk.redBright.bold("❌ An error occurred:"), message);
}

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
