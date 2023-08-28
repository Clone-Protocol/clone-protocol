import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getFaucetData,
  createTokenMint,
  getCloneData,
  getCloneClient,
} from "../utils";
import { createInitializeInstruction } from "../../sdk/generated/mock-asset-faucet";

exports.command = "initialize-collateral";
exports.desc = "Initializes mock collateral";
exports.builder = () => {};
exports.handler = async function () {
  try {
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const [__, faucetAddress] = getFaucetData();

    const mockCollateralMint = anchor.web3.Keypair.generate();

    await createTokenMint(provider, {
      mint: mockCollateralMint,
      scale: cloneClient.clone!.collateral.scale,
      authority: faucetAddress,
    });

    let ix = createInitializeInstruction({
      payer: provider.publicKey!,
      faucet: faucetAddress,
      mint: mockCollateralMint.publicKey,
    });

    await provider.sendAndConfirm(new Transaction().add(ix), [
      mockCollateralMint,
    ]);

    // Update the config file
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    config.collateral = mockCollateralMint.publicKey.toString();

    fs.writeFileSync("./config.json", JSON.stringify(config));

    successLog("Mock Jupiter Program Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Mock Jupiter Program:\n${error.message}`);
  }
};
