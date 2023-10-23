import { BN } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCollateral,
  getOrCreateAssociatedTokenAccount,
  getFaucetData,
  COLLATERAL_SCALE,
} from "../utils";
import { toScale } from "../../sdk/src/clone";
import { Argv } from "yargs";
import { createMintAssetInstruction } from "../../sdk/generated/mock-asset-faucet";

interface CommandArguments extends Argv {
  amount: number;
}

exports.command = "mint-collateral <amount>";
exports.desc = "Mints mock collateral into user's wallet";
exports.builder = (yargs: CommandArguments) => {
  return yargs.positional("amount", {
    describe: "The amount of mock collateral to mint",
    type: "number",
  });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const provider = anchorSetup();

    const [__, faucetAddress] = getFaucetData();

    const collateralMint = getCollateral();

    const amount = new BN(
      `${toScale(yargs.amount, COLLATERAL_SCALE)}`
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
    successLog(`${yargs.amount} Mock Collateral Minted!`);
  } catch (error: any) {
    errorLog(`Failed to mint mock collateral:\n${error.message}`);
  }
};
