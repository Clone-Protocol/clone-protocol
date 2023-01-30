import { PublicKey } from "@solana/web3.js";
import { RawDecimal } from "./decimal";
import { BN } from "@project-serum/anchor";

export interface Manager {
  usdiMint: PublicKey;
  tokenData: PublicKey;
  admin: PublicKey;
  bump: number;
  liquidationConfig: LiquidationConfig;
}

export interface LiquidationConfig {
  liquidatorFee: RawDecimal;
  collateralFullLiquidationThreshold: RawDecimal;
  maxHealthLiquidation: RawDecimal;
}

export interface User {
  isManager: BN;
  authority: PublicKey;
  singlePoolComets: PublicKey;
  mintPositions: PublicKey;
  liquidityPositions: PublicKey;
  comet: PublicKey;
}

export interface TokenData {
  manager: PublicKey;
  numPools: BN;
  numCollaterals: BN;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
  chainlinkProgram: PublicKey;
  ilHealthScoreCoefficient: RawDecimal;
}

export interface LiquidityPositions {
  owner: PublicKey;
  numPositions: BN;
  liquidityPositions: Array<LiquidityPosition>;
}

export interface LiquidityPosition {
  authority: PublicKey;
  liquidityTokenValue: RawDecimal;
  poolIndex: number;
}

export interface MintPositions {
  owner: PublicKey;
  numPositions: BN;
  mintPositions: Array<MintPosition>;
}

export interface MintPosition {
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
  priceFeedAddresses: Array<PublicKey>;
  price: RawDecimal;
  twap: RawDecimal;
  confidence: RawDecimal;
  status: number;
  lastUpdate: number;
  stableCollateralRatio: RawDecimal;
  cryptoCollateralRatio: RawDecimal;
  healthScoreCoefficient: RawDecimal;
}

export interface Pool {
  iassetTokenAccount: PublicKey;
  usdiTokenAccount: PublicKey;
  liquidityTokenMint: PublicKey;
  liquidationIassetTokenAccount: PublicKey;
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
