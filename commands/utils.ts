import os from "os";
import toml from "toml";
import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  Account,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import { Provider, BN } from "@coral-xyz/anchor";
import { CloneClient, CLONE_TOKEN_SCALE, toCloneScale } from "../sdk/src/clone";
import { Clone as CloneAccount } from "../sdk/generated/clone";
import { CloneStaking } from "../sdk/generated/clone-staking";

const chalk = require("chalk");

export const COLLATERAL_SCALE = 7;

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

  return provider;
}

export function getCloneData() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const cloneProgramId = new PublicKey(config.clone);

  const [cloneAccountAddress, ___] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone")],
    cloneProgramId
  );

  return [cloneProgramId, cloneAccountAddress];
}

export async function getCloneClient(
  provider: anchor.AnchorProvider,
  cloneProgramId: PublicKey,
  cloneAccountAddress: PublicKey
) {
  const account = await CloneAccount.fromAccountAddress(
    provider.connection,
    cloneAccountAddress
  );
  const cloneClient = new CloneClient(provider, account, cloneProgramId);

  return cloneClient;
}

export function getFaucetData() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const faucetProgramId = new PublicKey(config.faucet);

  let [faucetAddress, _] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet")],
    faucetProgramId
  );

  return [faucetProgramId, faucetAddress];
}

export function getCloneStakingData() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const cloneStakingProgramId = new PublicKey(config.staking);

  const [cloneStakingAddress, ___] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone-staking")],
    cloneStakingProgramId
  );

  return [cloneStakingProgramId, cloneStakingAddress];
}
export async function getCloneStakingAccount(
  provider: anchor.AnchorProvider,
  cloneStakingAddress: PublicKey
) {
  return await CloneStaking.fromAccountAddress(
    provider.connection,
    cloneStakingAddress
  );
}

export function getPythData() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  const pythProgramId = new PublicKey(config.jup);

  const [pythAddress, ___] = PublicKey.findProgramAddressSync(
    [Buffer.from("pyth")],
    pythProgramId
  );

  return [pythProgramId, pythAddress];
}

export function getCollateral() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  return new PublicKey(config.collateral);
}

export function getCLN() {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

  return new PublicKey(config.cln);
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

export const createTokenMint = async (
  provider: anchor.AnchorProvider,
  opts: { mint?: anchor.web3.Keypair; scale?: number; authority?: PublicKey }
): Promise<PublicKey> => {
  let tokenMint = opts.mint ?? anchor.web3.Keypair.generate();
  let tx = new Transaction().add(
    // create cln mint account
    SystemProgram.createAccount({
      fromPubkey: provider.publicKey!,
      newAccountPubkey: tokenMint.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
      programId: TOKEN_PROGRAM_ID,
    }),
    // init clone mint account
    createInitializeMintInstruction(
      tokenMint.publicKey,
      opts.scale ?? CLONE_TOKEN_SCALE,
      opts.authority ?? provider.publicKey!,
      null
    )
  );
  await provider.sendAndConfirm(tx, [tokenMint]);
  return tokenMint.publicKey;
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

export const fromCloneScale = (x: number): number => {
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
