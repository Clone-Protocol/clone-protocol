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
  minOvercollateralRatio: number;
  maxLiquidationCollateralRatio: number;
  poolTradingFee: number;
  treasuryTradingFee: number;
  ilHealthScoreCoefficient: number;
  healthScoreCoefficient: number;
  liquidationDiscountRate: number;
  oracleIndex: number;
  underlyingAssetMint: string;
}

exports.command = "add-pool";

exports.desc = "Adds a new onAsset pool to Clone";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("min-overcollateral-ratio", {
      describe: "The minimum overcollateral ratio for borrow positions",
      type: "number",
      default: 150,
    })
    .option("max-liquidation-collateral-ratio", {
      describe: "The maximum overcollateral ratio for borrow positions after a liquidation",
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
    .option("oracle-index", {
      describe: "The index of the oracle feed for this onAsset",
      type: "number",
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

    const underlyingAssetMint = new PublicKey(yargs.underlyingAssetMint);

    await cloneClient.initializePool(
      cloneProgram.provider.publicKey!,
      yargs.minOvercollateralRatio,
      yargs.maxLiquidationCollateralRatio,
      yargs.poolTradingFee,
      yargs.treasuryTradingFee,
      yargs.ilHealthScoreCoefficient,
      yargs.healthScoreCoefficient,
      yargs.liquidationDiscountRate,
      yargs.oracleIndex,
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
