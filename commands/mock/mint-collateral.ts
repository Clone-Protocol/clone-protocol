import { BN } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCollateral,
  getOrCreateAssociatedTokenAccount,
  getFaucetData,
  getCloneData,
  getCloneClient,
} from "../utils";
import { toScale } from "../../sdk/src/clone";
import { Argv } from "yargs";
import { createMintAssetInstruction } from "../../sdk/generated/mock-asset-faucet";

interface CommandArguments extends Argv {
  amount: number;
}

exports.command = "mint-collateral <amount>";
exports.desc = "Mints mock USDC into user's wallet";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("amount", {
    describe: "The amount of mock USDC to mint",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const [__, faucetAddress] = getFaucetData();

    const collateralMint = getCollateral();

    const amount = new BN(
      `${toScale(yargs.amount, cloneClient.clone!.collateral.scale)}`
    );
    const mockCollateralTokenAccountInfo =
      await getOrCreateAssociatedTokenAccount(provider, collateralMint);

    const ix = createMintAssetInstruction(
      {
        minter: provider.publicKey!,
        faucet: faucetAddress,
        mint: collateralMint,
        tokenAccount: mockCollateralTokenAccountInfo.address,
      },
      { amount: amount }
    );

    await provider.sendAndConfirm(new Transaction().add(ix));
    successLog(`${yargs.amount} Mock USDC Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint mock USDC:\n${error.message}`);
  }
};
