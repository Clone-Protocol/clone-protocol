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
import { DEVNET_TOKEN_SCALE, toDevnetScale } from "../sdk/src/clone";

const chalk = require("chalk");

export function anchorSetup() {
  // Read the network and wallet from the config file
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  const network = config.network;
  let wallet = config.wallet;
  let provider: anchor.AnchorProvider;

  // Parse Anchor.toml
  if (network === "localnet" && !wallet) {
    const anchorConfig = toml.parse(fs.readFileSync("./Anchor.toml", "utf-8"));
    const homeDir = os.homedir();
    wallet = anchorConfig.provider.wallet.replace("~", homeDir);

    process.env.ANCHOR_WALLET = wallet;

    provider = anchor.AnchorProvider.local();
  } else {
    // Read the wallet file to get the exported private key
    const walletKeyPair = JSON.parse(fs.readFileSync(wallet, "utf8"));

    // Create a new anchor.Wallet instance using the exported private key
    const walletInstance = new anchor.Wallet(walletKeyPair);

    switch (network) {
      case "devnet":
        provider = new anchor.AnchorProvider(
          new anchor.web3.Connection("https://api.devnet.solana.com"),
          walletInstance,
          anchor.AnchorProvider.defaultOptions()
        );
        break;
      case "mainnet":
        provider = new anchor.AnchorProvider(
          new anchor.web3.Connection("https://api.mainnet-beta.solana.com"),
          walletInstance,
          anchor.AnchorProvider.defaultOptions()
        );
        break;
      default:
        throw Error("invalid network");
    }
  }

  anchor.setProvider(provider);

  return { network: network, provider: provider };
}

export function getCloneProgram(
  network: string,
  provider: anchor.AnchorProvider
) {
  let cloneProgramId: PublicKey;

  switch (network) {
    case "localnet":
      const anchorConfig = toml.parse(
        fs.readFileSync("./Anchor.toml", "utf-8")
      );
      const localnetProgramId: string = anchorConfig.programs.localnet.clone;
      cloneProgramId = new PublicKey(localnetProgramId);
      break;
    case "devnet":
      // Use the manually provided program id for devnet
      cloneProgramId = new PublicKey("YOUR_DEVNET_PROGRAM_ID");
      throw Error("invalid network");
    case "mainnet":
      errorLog(`Mainnet not implemented for this command`);
      throw Error("invalid network");
    default:
      throw Error("invalid network");
  }

  return new Program<Clone>(cloneIDL, cloneProgramId, provider);
}

export function getJupiterProgram(
  network: string,
  provider: anchor.AnchorProvider
) {
  let mockJupProgramId: PublicKey;

  switch (network) {
    case "localnet":
      const anchorConfig = toml.parse(
        fs.readFileSync("./Anchor.toml", "utf-8")
      );
      const localnetProgramId: string =
        anchorConfig.programs.localnet.jupiter_agg_mock;
      mockJupProgramId = new PublicKey(localnetProgramId);
      break;
    case "devnet":
      // Use the manually provided program id for devnet
      mockJupProgramId = new PublicKey("YOUR_DEVNET_PROGRAM_ID");
      errorLog(`Devnet not implemented for this command`);
      throw Error("invalid network");
    case "mainnet":
      errorLog(`Mainnet not implemented for this command`);
      throw Error("invalid network");
    default:
      throw Error("invalid network");
  }
  return new Program<JupiterAggMock>(mockJupIDL, mockJupProgramId, provider);
}

export function getPythProgram(
  network: string,
  provider: anchor.AnchorProvider
) {
  let pythProgramId: PublicKey;

  switch (network) {
    case "localnet":
      const anchorConfig = toml.parse(
        fs.readFileSync("./Anchor.toml", "utf-8")
      );
      const localnetProgramId: string = anchorConfig.programs.localnet.pyth;
      pythProgramId = new PublicKey(localnetProgramId);
      break;
    case "devnet":
      // Use the manually provided program id for devnet
      pythProgramId = new PublicKey("YOUR_DEVNET_PROGRAM_ID");
      errorLog(`Devnet not implemented for this command`);
      throw Error("invalid network");
    case "mainnet":
      errorLog(`Mainnet not implemented for this command`);
      throw Error("invalid network");
    default:
      throw Error("invalid network");
  }
  return new Program<Pyth>(pythIDL, pythProgramId, provider);
}

export async function getUSDC(
  network: string,
  provider: anchor.AnchorProvider
) {
  let usdc: PublicKey;

  switch (network) {
    case "localnet":
      const jupiterProgram = getJupiterProgram(network, provider);
      let [jupiterAddress, _] = await PublicKey.findProgramAddress(
        [anchor.utils.bytes.utf8.encode("jupiter")],
        jupiterProgram.programId
      );
      usdc = (await jupiterProgram.account.jupiter.fetch(jupiterAddress))
        .usdcMint;
      break;
    case "devnet":
      errorLog(`Devnet not implemented for this command`);
      throw Error("invalid network");
    case "mainnet":
      errorLog(`Mainnet not implemented for this command`);
      throw Error("invalid network");
    default:
      throw Error("invalid network");
  }

  return usdc;
}

export async function getMockAssetMint(
  network: string,
  provider: anchor.AnchorProvider,
  index: number
) {
  let assetMint: PublicKey;

  switch (network) {
    case "localnet":
      const jupiterProgram = getJupiterProgram(network, provider);
      let [jupiterAddress, _] = await PublicKey.findProgramAddress(
        [anchor.utils.bytes.utf8.encode("jupiter")],
        jupiterProgram.programId
      );
      assetMint = (await jupiterProgram.account.jupiter.fetch(jupiterAddress))
        .assetMints[index];
      break;
    default:
      throw Error("invalid network");
  }

  return assetMint;
}

export async function getAssetPriceFeed(
  network: string,
  provider: anchor.AnchorProvider,
  index: number
) {
  let priceFeed: PublicKey;

  switch (network) {
    case "localnet":
      priceFeed = await getMockAssetPriceFeed(network, provider, index);
      break;
    case "devnet":
      errorLog(`Devnet not implemented for this command`);
      throw Error("invalid network");
    case "mainnet":
      errorLog(`Mainnet not implemented for this command`);
      throw Error("invalid network");
    default:
      throw Error("invalid network");
  }

  return priceFeed;
}

export async function getMockAssetPriceFeed(
  network: string,
  provider: anchor.AnchorProvider,
  index: number
) {
  let priceFeed: PublicKey;

  switch (network) {
    case "localnet":
      const jupiterProgram = getJupiterProgram(network, provider);
      let [jupiterAddress, _] = await PublicKey.findProgramAddress(
        [anchor.utils.bytes.utf8.encode("jupiter")],
        jupiterProgram.programId
      );
      priceFeed = (await jupiterProgram.account.jupiter.fetch(jupiterAddress))
        .oracles[index];
      break;
    default:
      throw Error("invalid network");
  }

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

export const convertToRawDecimal = (num: number) => {
  let temp = new Decimal(
    BigInt(toDevnetScale(num).toNumber()),
    BigInt(DEVNET_TOKEN_SCALE)
  );
  return temp.toRawDecimal();
};

export const fromDevnetScale = (x: number): number => {
  const scale = Math.pow(10, DEVNET_TOKEN_SCALE);
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
