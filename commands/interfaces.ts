import { PublicKey } from "@solana/web3.js";
import { RawDecimal } from "../sdk/src/decimal";
import { BN } from "@coral-xyz/anchor";

export interface Jupiter {
    usdcMint: PublicKey;
    assetMints: Array<PublicKey>;
    oracles: Array<PublicKey>;
    answer: RawDecimal;
    nAssets: number;
    bump: number;
  }