import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createPriceFeed } from "../../sdk/src/oracle";
import {
  successLog,
  errorLog,
  anchorSetup,
  getMockJupiterProgram,
  getPythProgram,
} from "../utils";import { Argv } from "yargs";

interface CommandArguments extends Argv {
  price: number;
  expo: number;
}

exports.command = "add-asset [price] [expo]";
exports.desc = "Adds a mock asset using the Mock Jupiter and the Pyth program";
exports.builder = (yargs: CommandArguments) => {
    return yargs
      .positional("price", {
        describe: "The initial price of the mock asset",
        type: "number",
        default: 10,
      })
      .positional("expo", {
        describe: "The exponent of the mock asset",
        type: "number",
        default: -7,
      })
  };
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    if (setup.network != "localnet") {
      throw Error("Mock instruction must be run on localnet")
    }
    const jupiterProgram = getMockJupiterProgram(setup.provider);
    const pythProgram = getPythProgram(setup.provider);

    let [jupiterAddress, _] = await PublicKey.findProgramAddress(
      [anchor.utils.bytes.utf8.encode("jupiter")],
      jupiterProgram.programId
    );

    let price = yargs.price;
    const expo = yargs.expo;
    const conf = new BN((price / 10) * 10 ** -expo);

    const priceFeed = await createPriceFeed(pythProgram, price, expo, conf);

    const mockAssetMint = anchor.web3.Keypair.generate();

    await jupiterProgram.methods
      .createAsset(priceFeed)
      .accounts({
        payer: jupiterProgram.provider.publicKey!,
        assetMint: mockAssetMint.publicKey,
        jupiterAccount: jupiterAddress,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([mockAssetMint])
      .rpc();

    successLog(`Mock Asset created with\nprice=$${yargs.price}\nexpo=${yargs.expo}`);
  } catch (error: any) {
    errorLog(`Failed to Create Mock Asset:\n${error.message}`);
  }
};
