import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { CloneClient } from "../../sdk/src/clone";
import { successLog, errorLog, anchorSetup, getCloneProgram } from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  stableCollateralRatio: number;
  cryptoCollateralRatio: number;
  poolTradingFee: number;
  treasuryTradingFee: number;
  priceFeed: string;
  ilHealthScoreCoefficient: number;
  healthScoreCoefficient: number;
  liquidationDiscountRate: number;
  maxOwnershipPct: number;
  underlyingAssetMint: string;
}

exports.command = "add-pool";

exports.desc = "Adds a new onAsset pool to Clone";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("stable-collateral-ratio", {
      describe: "The stable collateral ratio",
      type: "number",
      default: 150,
    })
    .option("crypto-collateral-ratio", {
      describe: "The crypto collateral ratio",
      type: "number",
      default: 200,
    })
    .option("pool-trading-fee", {
      describe: "The pool trading fee",
      type: "number",
      default: 200,
    })
    .option("treasury-trading-fee", {
      describe: "The treasury trading fee",
      type: "number",
      default: 100,
    })
    .option("price-feed", {
      describe: "The price feed",
      type: "string",
    })
    .option("il-health-score-coefficient", {
      describe: "The IL health score coefficient",
      type: "number",
      default: 128.288,
    })
    .option("health-score-coefficient", {
      describe: "The health score coefficient",
      type: "number",
      default: 1.059,
    })
    .option("liquidation-discount-rate", {
      describe: "The liquidation discount rate",
      type: "number",
      default: 500,
    })
    .option("max-ownership-pct", {
      describe: "The maximum ownership percentage",
      type: "number",
      default: 10,
    })
    .option("underlying-asset-mint", {
      describe: "The underlying asset mint",
      type: "string",
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.provider);

    let cloneClient = new CloneClient(cloneProgram.programId, setup.provider);
    await cloneClient.loadClone();

    const priceFeed = new PublicKey(yargs.priceFeed);
    const underlyingAssetMint = new PublicKey(yargs.underlyingAssetMint);

    await cloneClient.initializePool(
      cloneProgram.provider.publicKey!,
      yargs.stableCollateralRatio,
      yargs.cryptoCollateralRatio,
      yargs.poolTradingFee,
      yargs.treasuryTradingFee,
      priceFeed,
      yargs.ilHealthScoreCoefficient,
      yargs.healthScoreCoefficient,
      yargs.liquidationDiscountRate,
      yargs.maxOwnershipPct,
      underlyingAssetMint
    );

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[Number(tokenData.numPools) - 1];

    const treasuryOnAssetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        cloneClient.clone!.treasuryAddress,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(
        await createAssociatedTokenAccountInstruction(
          cloneClient.provider.publicKey!,
          treasuryOnAssetAssociatedTokenAddress,
          cloneClient.clone!.treasuryAddress,
          pool.assetInfo.onassetMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    );

    successLog("Pool Added!");
  } catch (error: any) {
    errorLog(`Failed to add pool:\n${error.message}`);
  }
};
