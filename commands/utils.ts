import os from "os";
import toml from "toml";
import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import {
  JupiterAggMock,
  IDL as mockJupIDL,
} from "../sdk/src/idl/jupiter_agg_mock";
import { Clone, IDL as cloneIDL } from "../sdk/src/idl/clone";
import { Pyth, IDL as pythIDL } from "../sdk/src/idl/pyth";

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

export function successLog(message: string) {
  console.log(chalk.greenBright.bold("✨ Success:"), message);
}

export function errorLog(message: string) {
  console.error(chalk.redBright.bold("❌ An error occurred:"), message);
}
