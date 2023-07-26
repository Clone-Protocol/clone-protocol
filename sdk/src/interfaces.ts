import { PublicKey } from "@solana/web3.js";
import { RawDecimal } from "./decimal";
import { BN } from "@coral-xyz/anchor";

export interface Clone {
  onusdMint: PublicKey;
  tokenData: PublicKey;
  admin: PublicKey;
  auth: Array<PublicKey>;
  bump: number;
  liquidationConfig: LiquidationConfig;
  treasuryAddress: PublicKey;
  eventCounter: BN;
}

export interface LiquidationConfig {
  cometLiquidatorFee: RawDecimal;
  borrowLiquidatorFee: RawDecimal;
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
  numOracles: BN;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
  oracles: Array<OracleInfo>;
}

export interface OracleInfo {
  pythAddress: PublicKey;
  price: RawDecimal;
  status: BN;
  lastUpdateSlot: BN;
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
  oracleInfoIndex: BN;
  minOvercollateralRatio: RawDecimal;
  maxLiquidationOvercollateralRatio: RawDecimal;
  ilHealthScoreCoefficient: RawDecimal;
  positionHealthScoreCoefficient: RawDecimal;
  liquidationDiscountRate: RawDecimal;
}

export interface Pool {
  underlyingAssetTokenAccount: PublicKey;
  committedOnusdLiquidity: RawDecimal;
  onusdIld: RawDecimal;
  onassetIld: RawDecimal;
  treasuryTradingFee: RawDecimal;
  liquidityTradingFee: RawDecimal;
  totalMintedAmount: RawDecimal;
  assetInfo: AssetInfo;
  status: number;
}

export interface Collateral {
  oracleInfoIndex: BN;
  mint: PublicKey;
  vault: PublicKey;
  vaultOnusdSupply: RawDecimal;
  vaultMintSupply: RawDecimal;
  vaultCometSupply: RawDecimal;
  stable: BN;
  collateralizationRatio: RawDecimal;
  liquidationDiscount: RawDecimal;
  status: number;
}
