import { PublicKey } from "@solana/web3.js";
import { RawDecimal } from "./decimal";
import { BN } from "@coral-xyz/anchor";

export interface Clone {
  onusdMint: PublicKey;
  tokenData: PublicKey;
  admin: PublicKey;
  bump: number;
  liquidationConfig: LiquidationConfig;
  treasuryAddress: PublicKey;
  eventCounter: BN;
}

export interface LiquidationConfig {
  liquidatorFee: RawDecimal;
  maxHealthLiquidation: RawDecimal;
}

export interface User {
  authority: PublicKey;
  borrowPositions: PublicKey;
  comet: PublicKey;
  bump: number;
}

export interface TokenData {
  clone: PublicKey;
  numPools: BN;
  numCollaterals: BN;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
}

export interface BorrowPositions {
  owner: PublicKey;
  numPositions: BN;
  borrowPositions: Array<BorrowPosition>;
}

export interface BorrowPosition {
  authority: PublicKey;
  collateralAmount: RawDecimal;
  poolIndex: number;
  collateralIndex: number;
  borrowedOnasset: RawDecimal;
}

export interface Comet {
  owner: PublicKey;
  numPositions: BN;
  numCollaterals: BN;
  positions: Array<CometPosition>;
  collaterals: Array<CometCollateral>;
}

export interface CometPosition {
  authority: PublicKey;
  poolIndex: number;
  onusdIldRebate: RawDecimal;
  onassetIldRebate: RawDecimal;
  committedOnusdLiquidity: RawDecimal;
}

export interface CometCollateral {
  authority: PublicKey;
  collateralAmount: RawDecimal;
  collateralIndex: number;
}

export interface AssetInfo {
  onassetMint: PublicKey;
  pythAddress: PublicKey;
  price: RawDecimal;
  twap: RawDecimal;
  confidence: RawDecimal;
  status: number;
  lastUpdate: number;
  stableCollateralRatio: RawDecimal;
  cryptoCollateralRatio: RawDecimal;
  ilHealthScoreCoefficient: RawDecimal;
  positionHealthScoreCoefficient: RawDecimal;
}

export interface Pool {
  underlyingAssetTokenAccount: PublicKey;
  committedOnusdLiquidity: RawDecimal;
  onusdIld: RawDecimal;
  onassetIld: RawDecimal;
  treasuryTradingFee: RawDecimal;
  liquidityTradingFee: RawDecimal;
  totalMintedAmount: RawDecimal;
  suppliedMintCollateralAmount: RawDecimal;
  assetInfo: AssetInfo;
  deprecated: number;
}

export interface Collateral {
  poolIndex: BN;
  mint: PublicKey;
  vault: PublicKey;
  vaultOnusdSupply: RawDecimal;
  vaultMintSupply: RawDecimal;
  vaultCometSupply: RawDecimal;
  stable: BN;
}
