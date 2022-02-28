import * as anchor from "@project-serum/anchor";
import { BN, Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Incept, IDL } from "./idl/exchange";
import {
  PublicKey,
  Connection,
  Network,
  Wallet,
  ConfirmOptions,
} from "@solana/web3.js";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

export class Incept {
  connection: Connection;
  network: Network;
  wallet: Wallet;
  programId: PublicKey;
  exchangeAuthority: PublicKey;
  program: Program<Incept>;
  manager: Manager;
  tokenData: TokenData;
  opts?: ConfirmOptions;
  managerPubkey: PublicKey;

  private constructor(
    connection: Connection,
    network: Network,
    wallet: Wallet,
    exchangeAuthority = PublicKey.default,
    programId = PublicKey.default,
    opts?: ConfirmOptions
  ) {
    this.managerPubkey = PublicKey.default;
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

  public async initializeManager(admin) {
    const [managerPubkey, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("manager")],
      this.program.programId
    );
    const usdiMint = anchor.web3.Keypair.generate();
    const liquidatedCometUsdiTokenAccount = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeManager(bump, {
      accounts: {
        admin: admin,
        manager: managerPubkey,
        usdiMint: usdiMint.publicKey,
        liquidatedCometUsdiTokenAccount:
          liquidatedCometUSDITokenAccount.publicKey,
        exchangeAuthority: exchangeAuthority,
        tokenData: tokenDataAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
    });
    this.managerPubkey = managerPubkey;
  }

  public onManagerAccountChange(fn: (state: Manager) => void) {
    this.program.account.manager
      .subscribe(this.manager)
      .on("change", (state: Manager) => {
        fn(state);
      });
  }

  public onTokenDataChange(fn: (state: TokenData) => void) {
    this.program.account.tokenData
      .subscribe(this.manager.tokenData)
      .on("change", (state: TokenData) => {
        fn(state);
      });
  }

  public async initializeUser(userWalletAddress) {}

  public async addCollateral(admin) {}

  public async addPool(admin) {}

  public async updatePrices() {
    const tokenData = await this.getTokenData(this.manager.tokenData);
    const priceFeeds = tokenData.pools
      .filter(
        (pool) => !pool.assetInfo.priceFeedAddress.equals(DEFAULT_PUBLIC_KEY)
      )
      .map((asset) => {
        return {
          pubkey: pool.assetInfo.priceFeedAddress,
          isWritable: false,
          isSigner: false,
        };
      });
    return await this.program.rpc.updatePrices({
      remainingAccounts: priceFeeds,
      accounts: {
        manager: this.managerPubkey,
        tokenData: this.manager.tokenData,
      },
    });
  }

  public async getTokenData() {}

  public async getManagerAddress() {
    const [managerPubkey, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode("manager"))],
      this.program.programId
    );
    return { managerPubkey, bump };
  }

  public async getUserAddress(userWalletAddress) {
    const [userPubkey, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("user"), userWalletAddress.toBuffer()],
      this.program.programId
    );
    return { userPubkey, bump };
  }
}

export interface Manager {
  usdiMint: PublicKey;
  liquidatedCometUsdi: PublicKey;
  tokenData: PublicKey;
  admin: PublicKey;
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
