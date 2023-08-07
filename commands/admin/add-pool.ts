import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneData,
  getCloneClient,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  minOvercollateralRatio: number;
  maxLiquidationCollateralRatio: number;
  liquidityTradingFeeBps: number;
  treasuryTradingFeeBps: number;
  ilHealthScoreCoefficient: number;
  healthScoreCoefficient: number;
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
      describe:
        "The maximum overcollateral ratio for borrow positions after a liquidation",
      type: "number",
      default: 200,
    })
    .option("liquidity-trading-fee-bps", {
      describe: "The liquidity trading fee",
      type: "number",
      default: 200,
    })
    .option("treasury-trading-fee-bps", {
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
    const provider = anchorSetup();
    const [cloneProgramID, cloneAccountAddress] = getCloneData();
    const cloneClient = await getCloneClient(
      provider,
      cloneProgramID,
      cloneAccountAddress
    );

    const underlyingAssetMint = new PublicKey(yargs.underlyingAssetMint);

    await cloneClient.initializePool(
      yargs.minOvercollateralRatio,
      yargs.maxLiquidationCollateralRatio,
      yargs.liquidityTradingFeeBps,
      yargs.treasuryTradingFeeBps,
      yargs.ilHealthScoreCoefficient,
      yargs.healthScoreCoefficient,
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

    await provider.sendAndConfirm!(
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
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
