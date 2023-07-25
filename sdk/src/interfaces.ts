import { PublicKey } from "@solana/web3.js";
import { RawDecimal } from "./decimal";
import { BN } from "@coral-xyz/anchor";

export interface Clone {
  onusdMint: PublicKey;
  tokenData: PublicKey;
  admin: PublicKey;
  auth: Array<PublicKey>;
  bump: number;
  liquidatorFeeBps: number,
  treasuryAddress: PublicKey;
  eventCounter: BN;
}

export interface LiquidationConfig {
  liquidatorFee: RawDecimal;
  maxHealthLiquidation: RawDecimal;
}

export interface User {
  borrows: Borrows;
  comet: Comet;
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

export interface Borrows {
  numPositions: BN;
  positions: Array<BorrowPosition>;
}

export interface BorrowPosition {
  collateralAmount: RawDecimal;
  poolIndex: number;
  collateralIndex: number;
  borrowedOnasset: RawDecimal;
}

export interface Comet {
  numPositions: BN;
  numCollaterals: BN;
  positions: Array<CometPosition>;
  collaterals: Array<CometCollateral>;
}

export interface CometPosition {
  poolIndex: number;
  onusdIldRebate: RawDecimal;
  onassetIldRebate: RawDecimal;
  committedOnusdLiquidity: RawDecimal;
}

export interface CometCollateral {
  collateralAmount: RawDecimal;
  collateralIndex: number;
}

export interface AssetInfo {
  onassetMint: PublicKey;
  oracleInfoIndex: BN;
  stableCollateralRatio: RawDecimal;
  cryptoCollateralRatio: RawDecimal;
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
  suppliedMintCollateralAmount: RawDecimal;
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
