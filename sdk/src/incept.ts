import { BN } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

export interface TokenData {
  manager: PublicKey;
  numPools: number;
  numCollaterals: number;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
}

export interface Value {
  val: BN;
  scale: number;
}

export interface AssetInfo {
  iassetMint: PublicKey;
  priceFeedAddress: PublicKey;
  price: Value;
  twap: Value;
  confidence: Value;
  status: number;
  lastUpdate: BN;
  stableCollateralRatio: Value;
  cryptoCollateralRatio: Value;
}

export interface Pool {
  iassetTokenAccount: PublicKey;
  usdiTokenAccount: PublicKey;
  liquidityTokenMint: PublicKey;
  cometLiquidityTokenAccount: PublicKey;
  assetInfo: AssetInfo;
}

export interface Collateral {
  poolIndex: u8;
  mint: PublicKey;
  vault: PublicKey;
  vaultUsdiSupply: Value;
  vaultMintSupply: Value;
  vaultCometSupply: Value;
  status: number;
}
