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
  priceFeed: number;
  source: number;
}

exports.command = "add-oracle <price-feed> [source]";
exports.desc = "Adds a new onAsset oracle to Clone";
exports.builder = (yargs: CommandArguments) => {
  return yargs
    .positional("price-feed", {
      describe: "The price feed for the oracle",
      type: "string",
    })
    .positional("source", {
      describe: "0 if Pyth, 1 if Switchboard",
      type: "number",
      default: 150,
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

    await cloneClient.updateOracles({
      params: {
        __kind: "Add",
        source: yargs.source,
        address: new PublicKey(yargs.priceFeed),
      },
    });

    successLog("Oracle Added!");
  } catch (error: any) {
    errorLog(`Failed to add oracle:\n${error.message}`);
  }
};
