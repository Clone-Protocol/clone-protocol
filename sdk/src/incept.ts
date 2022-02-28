import * as anchor from "@project-serum/anchor";
import { BN, Program } from "@project-serum/anchor";
import { Incept, IDL } from './idl/exchange'
import {
  PublicKey,
  Connection,
  Network,
  Wallet,
  ConfirmOptions,
} from "@solana/web3.js";

export class Exchange {
  connection: Connection;
  network: Network;
  wallet: Wallet;
  programId: PublicKey;
  exchangeAuthority: PublicKey;
  program: Program<ExchangeType>;
  manager: Manager;
  tokenData: TokenData;
  opts?: ConfirmOptions;
  stateAddress: PublicKey;

  private constructor(
    connection: Connection,
    network: Network,
    wallet: Wallet,
    exchangeAuthority = PublicKey.default,
    programId = PublicKey.default,
    opts?: ConfirmOptions
  ) {
    this.stateAddress = PublicKey.default;
    this.manager = {} as Manager;
    this.tokenData = {} as TokenData;
    this.connection = connection;
    this.network = network;
    this.wallet = wallet;
    this.opts = opts;
    const provider = new Provider(
      connection,
      wallet,
      opts || Provider.defaultOptions()
    );
    switch (network) {
      case Network.LOCAL:
        this.programId = programId;
        this.exchangeAuthority = exchangeAuthority;
        this.program = new Program<Incept>(IDL, this.programId, provider);
        break;
      case Network.TEST:
        this.programId = TEST_NET.exchange;
        this.exchangeAuthority = TEST_NET.exchangeAuthority;
        this.program = new Program<Incept>(IDL, this.programId, provider);
        break;
      case Network.DEV:
        this.programId = DEV_NET.exchange;
        this.exchangeAuthority = DEV_NET.exchangeAuthority;
        this.program = new Program<Incept>(IDL, this.programId, provider);
        break;
      case Network.MAIN:
        this.programId = MAIN_NET.exchange;
        this.exchangeAuthority = MAIN_NET.exchangeAuthority;
        this.program = new Program<Incept>(IDL, this.programId, provider);
        break;
      default:
        throw new Error("Not supported");
    }
  }
}

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
