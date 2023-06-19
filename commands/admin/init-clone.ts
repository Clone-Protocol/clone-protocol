import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { CloneClient } from "../../sdk/src/clone";
import {
  successLog,
  errorLog,
  anchorSetup,
  getCloneProgram,
  getUSDC,
} from "../utils";
import { Argv } from "yargs";

interface CommandArguments extends Argv {
  ilHealthScoreCutoff: number;
  ilLiquidationRewardPct: number;
  maxHealthLiquidation: number;
  liquidatorFee: number;
}

exports.command = "init-clone";
exports.desc = "Initializes the Clone program with optional parameters";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .option("il-health-score-cutoff", {
      describe: "The impermanent loss health score cutoff",
      type: "number",
      default: 20,
    })
    .option("il-liquidation-reward-pct", {
      describe: "The impermanent loss liquidation reward percentage",
      type: "number",
      default: 5,
    })
    .option("max-health-liquidation", {
      describe: "The maximum health of a comet after liquidation",
      type: "number",
      default: 20,
    })
    .option("liquidator-fee", {
      describe: "The liquidator fee",
      type: "number",
      default: 500,
    });
};
exports.handler = async function (yargs: CommandArguments) {
  try {
    const setup = anchorSetup();
    const cloneProgram = getCloneProgram(setup.network, setup.provider);
    const usdc = await getUSDC(setup.network, setup.provider);

    let cloneClient = new CloneClient(cloneProgram.programId, setup.provider);

    const treasuryAddress = anchor.web3.Keypair.generate();

    await cloneClient.initializeClone(
      yargs.ilHealthScoreCutoff,
      yargs.ilLiquidationRewardPct,
      yargs.maxHealthLiquidation,
      yargs.liquidatorFee,
      treasuryAddress.publicKey,
      usdc
    );

    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(
        await createAssociatedTokenAccountInstruction(
          cloneClient.provider.publicKey!,
          treasuryOnusdAssociatedTokenAddress,
          treasuryAddress.publicKey,
          cloneClient.clone!.onusdMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    );

    successLog("Clone Initialized!");
  } catch (error: any) {
    errorLog(`Failed to Initialize Clone Program:\n${error.message}`);
  }
};
