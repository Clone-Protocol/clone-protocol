import { PublicKey } from "@solana/web3.js";
import { RawDecimal } from "./decimal";
import { BN } from "@coral-xyz/anchor";

export interface Incept {
  usdiMint: PublicKey;
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
  singlePoolComets: PublicKey;
  borrowPositions: PublicKey;
  comet: PublicKey;
  bump: number;
}

export interface TokenData {
  incept: PublicKey;
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
  borrowedIasset: RawDecimal;
}

export interface LiquidationStatus {
  healthy: object;
  partially: object;
  fully: object;
}

export interface CometLiquidation {
  status: number;
  excessTokenTypeIsUsdi: number;
  excessTokenAmount: RawDecimal;
}

export interface Comet {
  isSinglePool: BN;
  owner: PublicKey;
  numPositions: BN;
  numCollaterals: BN;
  positions: Array<CometPosition>;
  collaterals: Array<CometCollateral>;
}

export interface CometPosition {
  authority: PublicKey;
  poolIndex: number;
  borrowedUsdi: RawDecimal;
  borrowedIasset: RawDecimal;
  liquidityTokenValue: RawDecimal;
  cometLiquidation: CometLiquidation;
}

export interface CometCollateral {
  authority: PublicKey;
  collateralAmount: RawDecimal;
  collateralIndex: number;
}

export interface Value {
  val: BN;
  scale: BN;
}

export interface AssetInfo {
  iassetMint: PublicKey;
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
  iassetTokenAccount: PublicKey;
  usdiTokenAccount: PublicKey;
  liquidityTokenMint: PublicKey;
  underlyingAssetTokenAccount: PublicKey;
  cometLiquidityTokenAccount: PublicKey;
  iassetAmount: RawDecimal;
  usdiAmount: RawDecimal;
  liquidityTokenSupply: RawDecimal;
  treasuryTradingFee: RawDecimal;
  liquidityTradingFee: RawDecimal;
  totalMintedAmount: RawDecimal;
  suppliedMintCollateralAmount: RawDecimal;
  assetInfo: AssetInfo;
}

export interface Collateral {
  poolIndex: BN;
  mint: PublicKey;
  vault: PublicKey;
  vaultUsdiSupply: RawDecimal;
  vaultMintSupply: RawDecimal;
  vaultCometSupply: RawDecimal;
  stable: BN;
}
