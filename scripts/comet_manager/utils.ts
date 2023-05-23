import { PublicKey } from "@solana/web3.js";
import { TokenData, createUpdatePricesInstruction } from "../../sdk/generated/incept/index"


export const updatePricesInstructionCreate = (
    inceptAccountAddress: PublicKey,
    tokenDataAddress: PublicKey,
    tokenData: TokenData
  ) => {
    let indices: number[] = [];
    let priceFeeds: Array<{
      pubkey: PublicKey;
      isWritable: boolean;
      isSigner: boolean;
    }> = [];
  
    tokenData.pools.slice(0, Number(tokenData.numPools)).forEach((_, i) => {
      indices.push(i);
      priceFeeds.push({
        pubkey: tokenData.pools[i].assetInfo.pythAddress,
        isWritable: false,
        isSigner: false,
      });
    });
  
    let zero_padding = 128 - indices.length;
    for (let i = 0; i < zero_padding; i++) {
      indices.push(0);
    }
    return createUpdatePricesInstruction(
      {
        incept: inceptAccountAddress,
        tokenData: tokenDataAddress,
        anchorRemainingAccounts: priceFeeds,
      },
      { poolIndices: { indices } }
    );
  };
  