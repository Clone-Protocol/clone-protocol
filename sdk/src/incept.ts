import * as anchor from "@project-serum/anchor";
import { BN, Program, Provider, Wallet } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import { Incept as InceptProgram, IDL } from "./idl/incept";
import {
  PublicKey,
  Connection,
  ConfirmOptions,
  TransactionInstruction,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import { sleep, toScaledNumber, toScaledPercent, div, mul } from "./utils";
import {
  MintPositionsUninitialized,
  SinglePoolCometUninitialized,
  CalculationError,
} from "./error";
import { assert } from "chai";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
export const DEVNET_TOKEN_SCALE = 8;

export const toDevnetScale = (x: number) => {
  return new BN(x * 10 ** DEVNET_TOKEN_SCALE);
};

const TOKEN_DATA_SIZE = 181720; //175600;
const SINGLE_POOL_COMET_SIZE = 8208;
const MINT_POSITIONS_SIZE = 24528;
const LIQUIDITY_POSITIONS_SIZE = 16368;
const COMET_SIZE = 55168;

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export class Incept {
  connection: Connection;
  programId: PublicKey;
  program: Program<InceptProgram>;
  manager?: Manager;
  opts?: ConfirmOptions;
  managerAddress: [PublicKey, number];
  provider: Provider;

  public constructor(
    programId: PublicKey,
    provider: Provider,
    opts?: ConfirmOptions
  ) {
    this.managerAddress = [PublicKey.default, 0];
    this.connection = provider.connection;
    this.programId = programId;
    this.provider = provider;
    this.opts = opts;
    this.program = new Program<InceptProgram>(IDL, this.programId, provider);
  }
  public async initializeManager(
    chainlinkProgram: PublicKey,
    ilHealthScoreCoefficient: number,
    ilHealthScoreCutoff: number,
    ilLiquidationRewardPct: number
  ) {
    const managerPubkeyAndBump = await this.getManagerAddress();
    const usdiMint = anchor.web3.Keypair.generate();
    const liquidatedCometUsdiTokenAccount = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeManager(
      managerPubkeyAndBump[1],
      toDevnetScale(ilHealthScoreCoefficient),
      toDevnetScale(ilHealthScoreCutoff),
      toDevnetScale(ilLiquidationRewardPct),
      {
        accounts: {
          admin: this.provider.wallet.publicKey,
          manager: managerPubkeyAndBump[0],
          usdiMint: usdiMint.publicKey,
          liquidatedCometUsdiTokenAccount:
            liquidatedCometUsdiTokenAccount.publicKey,
          tokenData: tokenData.publicKey,
          rent: RENT_PUBKEY,
          chainlinkProgram: chainlinkProgram,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        instructions: [
          await this.program.account.tokenData.createInstruction(
            tokenData,
            TOKEN_DATA_SIZE
          ),
        ],
        signers: [usdiMint, tokenData, liquidatedCometUsdiTokenAccount],
      }
    );

    this.managerAddress = managerPubkeyAndBump;
    this.manager = (await this.program.account.manager.fetch(
      this.managerAddress[0]
    )) as Manager;
  }

  public async loadManager() {
    this.managerAddress = await this.getManagerAddress();
    this.manager = (await this.getManagerAccount()) as Manager;
  }

  public onManagerAccountChange(fn: (state: Manager) => void) {
    this.program.account.manager
      .subscribe(this.managerAddress[0])
      .on("change", (state: Manager) => {
        fn(state);
      });
  }

  public onTokenDataChange(fn: (state: TokenData) => void) {
    this.program.account.tokenData
      .subscribe(this.manager!.tokenData)
      .on("change", (state: TokenData) => {
        fn(state);
      });
  }

  public async getCollateral(collateralIndex: number) {
    const tokenData = (await this.getTokenData()) as TokenData;
    return tokenData.collaterals[collateralIndex];
  }

  public async initializeUser() {
    const { userPubkey, bump } = await this.getUserAddress();
    await this.program.rpc.initializeUser(bump, {
      accounts: {
        user: this.provider.wallet.publicKey,
        userAccount: userPubkey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
    });
  }

  public async addCollateral(
    admin: PublicKey,
    scale: number,
    stable: number,
    collateral_mint: PublicKey,
    collateralization_ratio: number = 0
  ) {
    const vaultAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.addCollateral(
      this.managerAddress[1],
      scale,
      stable,
      toDevnetScale(collateralization_ratio),
      {
        accounts: {
          admin: admin,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          collateralMint: collateral_mint,
          vault: vaultAccount.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        signers: [vaultAccount],
      }
    );
  }

  public async initializePool(
    admin: PublicKey,
    stableCollateralRatio: number,
    cryptoCollateralRatio: number,
    liquidityTradingFee: number,
    pythOracle: PublicKey,
    chainlinkOracle: PublicKey,
    healthScoreCoefficient: number
  ) {
    const usdiTokenAccount = anchor.web3.Keypair.generate();
    const iassetMintAccount = anchor.web3.Keypair.generate();
    const iassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidationIassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidityTokenMintAccount = anchor.web3.Keypair.generate();
    const cometLiquidityTokenAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializePool(
      this.managerAddress[1],
      stableCollateralRatio,
      cryptoCollateralRatio,
      liquidityTradingFee,
      toDevnetScale(healthScoreCoefficient),
      {
        accounts: {
          admin: admin,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          usdiTokenAccount: usdiTokenAccount.publicKey,
          iassetMint: iassetMintAccount.publicKey,
          iassetTokenAccount: iassetTokenAccount.publicKey,
          liquidationIassetTokenAccount:
            liquidationIassetTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
          pythOracle: pythOracle,
          chainlinkOracle: chainlinkOracle,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        signers: [
          usdiTokenAccount,
          iassetMintAccount,
          iassetTokenAccount,
          liquidationIassetTokenAccount,
          liquidityTokenMintAccount,
          cometLiquidityTokenAccount,
        ],
      }
    );
  }

  public async getPool(poolIndex: number) {
    const tokenData = (await this.getTokenData()) as TokenData;
    return tokenData.pools[poolIndex];
  }

  public async getPoolBalances(poolIndex: number) {
    let pool = await this.getPool(poolIndex);

    let iasset = 0;
    let usdi = 0;

    try {
      iasset = Number(
        (
          await this.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "confirmed"
          )
        ).value!.uiAmount
      );
    } catch {}

    try {
      usdi = Number(
        (
          await this.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "confirmed"
          )
        ).value!.uiAmount
      );
    } catch {}
    return [Number(iasset), Number(usdi)];
  }

  public async getAssetInfo(poolIndex: number) {
    const tokenData = (await this.getTokenData()) as TokenData;
    return tokenData.pools[poolIndex].assetInfo as AssetInfo;
  }

  public async updatePrices(signers?: Array<Keypair>, poolIndex?: number) {
    const updatePricesIx = await this.updatePricesInstruction(poolIndex);
    await this.provider.send(new Transaction().add(updatePricesIx), signers);
  }

  //NOTE: It seems like with too many pools (10) the maximum number of allowed transactions can be exceeded.
  public async updatePricesInstruction(poolIndex?: number) {
    const tokenData = await this.getTokenData();

    let priceFeeds: Array<{
      pubkey: PublicKey;
      isWritable: boolean;
      isSigner: boolean;
    }> = [];
    tokenData.pools.slice(0, Number(tokenData.numPools)).forEach((pool) => {
      priceFeeds.push({
        pubkey: pool.assetInfo.priceFeedAddresses[0],
        isWritable: false,
        isSigner: false,
      });
      priceFeeds.push({
        pubkey: pool.assetInfo.priceFeedAddresses[1],
        isWritable: false,
        isSigner: false,
      });
    });

    if (typeof poolIndex !== "undefined") {
      priceFeeds = priceFeeds.slice(2 * poolIndex, 2 * poolIndex + 2);
    }

    return (await this.program.instruction.updatePrices(
      this.managerAddress[1],
      {
        remainingAccounts: priceFeeds,
        accounts: {
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          chainlinkProgram: tokenData.chainlinkProgram,
        },
      }
    )) as TransactionInstruction;
  }

  public async getTokenData() {
    return (await this.program.account.tokenData.fetch(
      this.manager!.tokenData
    )) as TokenData;
  }

  public async getLiquidityPositions() {
    const userAccountData = (await this.getUserAccount()) as User;
    return (await this.program.account.liquidityPositions.fetch(
      userAccountData.liquidityPositions
    )) as LiquidityPositions;
  }

  public async getLiquidityPosition(liquidityIndex: number) {
    return (await this.getLiquidityPositions()).liquidityPositions[
      liquidityIndex
    ];
  }

  public async getMintPositions() {
    const userAccountData = (await this.getUserAccount()) as User;

    if (
      userAccountData.mintPositions.toString() === PublicKey.default.toString()
    ) {
      throw new MintPositionsUninitialized();
    }

    return (await this.program.account.mintPositions.fetch(
      userAccountData.mintPositions
    )) as MintPositions;
  }

  public async getMintPosition(mintIndex: number) {
    return (await this.getMintPositions()).mintPositions[mintIndex];
  }

  public async getSinglePoolComets(address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    if (userAccountData.singlePoolComets.equals(PublicKey.default)) {
      throw new SinglePoolCometUninitialized();
    }
    return (await this.program.account.singlePoolComets.fetch(
      userAccountData.singlePoolComets
    )) as SinglePoolComets;
  }
  public async getSinglePoolComet(cometIndex: number) {
    const singlePoolComets = await this.getSinglePoolComets();
    return (await this.program.account.comet.fetch(
      singlePoolComets.comets[cometIndex]
    )) as Comet;
  }

  public async getComet(forManager?: boolean, address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    return (await this.program.account.comet.fetch(
      forManager ? userAccountData.cometManager : userAccountData.comet
    )) as Comet;
  }

  public async getManagerAddress() {
    return await PublicKey.findProgramAddress(
      [Buffer.from("manager")],
      this.program.programId
    );
  }

  public async getManagerAccount() {
    return (await this.program.account.manager.fetch(
      this.managerAddress[0]
    )) as Manager;
  }

  public async getUserAddress(address?: PublicKey) {
    if (!address) {
      address = this.provider.wallet.publicKey;
    }

    const [userPubkey, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("user"), address.toBuffer()],
      this.program.programId
    );
    return { userPubkey, bump };
  }

  public async getUserAccount(address?: PublicKey) {
    if (!address) {
      const { userPubkey, bump } = await this.getUserAddress();
      address = userPubkey;
    }

    return (await this.program.account.user.fetch(address)) as User;
  }

  public async mintUsdi(
    amount: BN,
    userUsdiTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const mintUsdiIx = (await this.mintUsdiInstruction(
      amount,
      userUsdiTokenAccount,
      userCollateralTokenAccount,
      collateralIndex
    )) as TransactionInstruction;
    await this.provider.send(new Transaction().add(mintUsdiIx), signers);
  }

  public async mintUsdiInstruction(
    amount: BN,
    userUsdiTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    return (await this.program.instruction.mintUsdi(
      this.managerAddress[1],
      new BN(amount),
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          vault: tokenData.collaterals[collateralIndex].vault,
          usdiMint: this.manager!.usdiMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async initializeMintPosition(
    iassetAmount: BN,
    collateralAmount: BN,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction(poolIndex);
    const initializeMintPositionIx =
      await this.initializeMintPositionInstruction(
        userCollateralTokenAccount,
        userIassetTokenAccount,
        iassetAmount,
        collateralAmount,
        poolIndex,
        collateralIndex
      );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(initializeMintPositionIx),
      signers
    );
  }
  public async initializeMintPositionInstruction(
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();

    if (userAccount.mintPositions.equals(PublicKey.default)) {
      let { userPubkey, bump } = await this.getUserAddress();

      const mintPositionsAccount = anchor.web3.Keypair.generate();

      await this.program.rpc.initializeMintPositions(bump, {
        accounts: {
          user: this.provider.wallet.publicKey,
          userAccount: userPubkey,
          mintPositions: mintPositionsAccount.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        instructions: [
          await this.program.account.mintPositions.createInstruction(
            mintPositionsAccount,
            MINT_POSITIONS_SIZE
          ),
        ],
        signers: [mintPositionsAccount],
      });
    }
    userAccount = await this.getUserAccount();

    return (await this.program.instruction.initializeMintPosition(
      this.managerAddress[1],
      iassetAmount,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          mintPositions: userAccount.mintPositions,
          vault: tokenData.collaterals[collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          oracle: tokenData.pools[poolIndex].assetInfo.priceFeedAddresses[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addCollateralToMint(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const addCollateralToMintIx = await this.addCollateralToMintInstruction(
      userCollateralTokenAccount,
      collateralAmount,
      collateralIndex
    );
    await this.provider.send(
      new Transaction().add(addCollateralToMintIx),
      signers
    );
  }

  public async addCollateralToMintInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.addCollateralToMint(
      this.managerAddress[1],
      collateralIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          mintPositions: userAccount.mintPositions,
          vault: tokenData.collaterals[collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawCollateralFromMint(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromMintIx =
      await this.withdrawCollateralFromMintInstruction(
        this.provider.wallet.publicKey,
        userCollateralTokenAccount,
        collateralAmount,
        collateralIndex
      );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromMintIx),
      signers
    );
  }

  public async withdrawCollateralFromMintInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.withdrawCollateralFromMint(
      this.managerAddress[1],
      collateralIndex,
      collateralAmount,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          mintPositions: userAccount.mintPositions,
          vault: tokenData.collaterals[collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async payBackiAssetToMint(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    mintIndex: number,
    signers: Array<Keypair>
  ) {
    const payBackiAssetToMintIx = await this.payBackiAssetToMintInstruction(
      userIassetTokenAccount,
      iassetAmount,
      mintIndex
    );
    await this.provider.send(
      new Transaction().add(payBackiAssetToMintIx),
      signers
    );
  }
  public async payBackiAssetToMintInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    mintIndex: number
  ) {
    let mint = await this.getMintPosition(mintIndex);
    let assetInfo = await this.getAssetInfo(mint.poolIndex);
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.payBackMint(
      this.managerAddress[1],
      mintIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          mintPositions: userAccount.mintPositions,
          iassetMint: assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addiAssetToMint(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    mintIndex: number,
    signers: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addiAssetToMintIx = await this.addiAssetToMintInstruction(
      userIassetTokenAccount,
      iassetAmount,
      mintIndex
    );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(addiAssetToMintIx),
      signers
    );
  }
  public async addiAssetToMintInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    mintIndex: number
  ) {
    let mint = await this.getMintPosition(mintIndex);
    let assetInfo = await this.getAssetInfo(mint.poolIndex);
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.addIassetToMint(
      this.managerAddress[1],
      mintIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          mintPositions: userAccount.mintPositions,
          iassetMint: assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async closeMintPosition(
    userIassetTokenAccount: PublicKey,
    mintIndex: number,
    userCollateralTokenAccount: PublicKey,
    signers: Array<Keypair>
  ) {
    const mintPosition = await this.getMintPosition(mintIndex);

    const payBackiAssetToMintIx = await this.payBackiAssetToMintInstruction(
      userIassetTokenAccount,
      mintPosition.borrowedIasset.val,
      mintIndex
    );

    const withdrawCollateralFromMintIx =
      await this.withdrawCollateralFromMintInstruction(
        this.provider.wallet.publicKey,
        userCollateralTokenAccount,
        mintPosition.collateralAmount.val,
        mintPosition.collateralIndex
      );

    const updatePricesIx = await this.updatePricesInstruction(
      mintPosition.poolIndex
    );

    await this.provider.send(
      new Transaction()
        .add(payBackiAssetToMintIx)
        .add(updatePricesIx)
        .add(withdrawCollateralFromMintIx),
      signers
    );
  }

  public async initializeLiquidityPosition(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const initializeLiquidityPositionIx =
      await this.initializeLiquidityPositionInstruction(
        userUsdiTokenAccount,
        userIassetTokenAccount,
        userLiquidityTokenAccount,
        iassetAmount,
        poolIndex
      );
    await this.provider.send(
      new Transaction().add(initializeLiquidityPositionIx),
      signers
    );
  }
  public async initializeLiquidityPositionInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let pool = await tokenData.pools[poolIndex];

    if (userAccount.liquidityPositions.equals(PublicKey.default)) {
      let { userPubkey, bump } = await this.getUserAddress();

      const liquidityPositionsAccount = anchor.web3.Keypair.generate();

      await this.program.rpc.initializeLiquidityPositions(bump, {
        accounts: {
          user: this.provider.wallet.publicKey,
          userAccount: userPubkey,
          liquidityPositions: liquidityPositionsAccount.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        instructions: [
          await this.program.account.liquidityPositions.createInstruction(
            liquidityPositionsAccount,
            LIQUIDITY_POSITIONS_SIZE
          ),
        ],
        signers: [liquidityPositionsAccount],
      });
    }
    userAccount = await this.getUserAccount();

    return (await this.program.instruction.initializeLiquidityPosition(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          liquidityPositions: userAccount.liquidityPositions,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userLiquidityTokenAccount: userLiquidityTokenAccount,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidityTokenMint: pool.liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async provideLiquidity(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const provideLiquidityIx = await this.provideLiquidityInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      userLiquidityTokenAccount,
      iassetAmount,
      poolIndex
    );
    await this.provider.send(
      new Transaction().add(provideLiquidityIx),
      signers
    );
  }
  public async provideLiquidityInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let pool = tokenData.pools[poolIndex];

    //let userLiquidityPosition = await this.getLiquidityPosition(poolIndex);

    return (await this.program.instruction.provideLiquidity(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          liquidityPositions: userAccount.liquidityPositions,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userLiquidityTokenAccount: userLiquidityTokenAccount,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidityTokenMint: pool.liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawLiquidity(
    liquidityTokenAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityIx = await this.withdrawLiquidityInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      userLiquidityTokenAccount,
      liquidityTokenAmount,
      poolIndex
    );
    await this.provider.send(
      new Transaction().add(withdrawLiquidityIx),
      signers
    );
  }
  public async withdrawLiquidityInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();

    let pool = tokenData.pools[poolIndex];

    return (await this.program.instruction.withdrawLiquidity(
      this.managerAddress[1],
      poolIndex,
      liquidityTokenAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          liquidityPositions: userAccount.liquidityPositions,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userLiquidityTokenAccount: userLiquidityTokenAccount,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidityTokenMint: pool.liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async buySynth(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const buySynthIx = await this.buySynthInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex
    );
    await this.provider.send(new Transaction().add(buySynthIx), signers);
  }
  public async buySynthInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();

    return (await this.program.instruction.buySynth(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
          ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async sellSynth(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const buySynthIx = await this.sellSynthInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex
    );
    await this.provider.send(new Transaction().add(buySynthIx), signers);
  }
  public async sellSynthInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();

    return (await this.program.instruction.sellSynth(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
          ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async openNewSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    usdiAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    await this.initializeSinglePoolComet(poolIndex, collateralIndex);
    const updatePricesIx = await this.updatePricesInstruction(poolIndex);
    const singlePoolComets = await this.getSinglePoolComets();

    const addCollateralToSinglePoolCometIx =
      await this.addCollateralToSinglePoolCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        Number(singlePoolComets.numComets) - 1
      );
    const addLiquidityToSinglePoolCometIx =
      await this.addLiquidityToSinglePoolCometInstruction(
        usdiAmount,
        Number(singlePoolComets.numComets) - 1
      );
    await this.provider.send(
      new Transaction()
        .add(updatePricesIx)
        .add(addCollateralToSinglePoolCometIx)
        .add(addLiquidityToSinglePoolCometIx),
      signers
    );
  }

  public async initializeSinglePoolComet(
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();

    if (userAccount.singlePoolComets.equals(PublicKey.default)) {
      let { userPubkey, bump } = await this.getUserAddress();

      const singlePoolCometsAccount = anchor.web3.Keypair.generate();

      await this.program.rpc.initializeSinglePoolComets(bump, {
        accounts: {
          user: this.provider.wallet.publicKey,
          userAccount: userPubkey,
          singlePoolComets: singlePoolCometsAccount.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        instructions: [
          await this.program.account.singlePoolComets.createInstruction(
            singlePoolCometsAccount,
            SINGLE_POOL_COMET_SIZE
          ),
        ],
        signers: [singlePoolCometsAccount],
      });
    }
    userAccount = await this.getUserAccount();

    const comets = await this.getSinglePoolComets();

    const singlePoolCometAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeSinglePoolComet(
      this.managerAddress[1],
      poolIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          singlePoolComets: userAccount.singlePoolComets,
          singlePoolComet: singlePoolCometAccount.publicKey,
          vault: tokenData.collaterals[collateralIndex].vault,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        instructions: [
          await this.program.account.comet.createInstruction(
            singlePoolCometAccount,
            COMET_SIZE
          ),
        ],
        signers: [singlePoolCometAccount],
      }
    );
  }

  public async addCollateralToSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const addCollateralToCometIx =
      await this.addCollateralToSinglePoolCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        cometIndex
      );
    await this.provider.send(
      new Transaction().add(addCollateralToCometIx),
      signers
    );
  }
  public async addCollateralToSinglePoolCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let singlePoolComet = await this.getSinglePoolComet(cometIndex);

    return (await this.program.instruction.addCollateralToComet(
      this.managerAddress[1],
      singlePoolComet.collaterals[0].collateralIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          comet: cometAddress,
          vault:
            tokenData.collaterals[
              singlePoolComet.collaterals[0].collateralIndex
            ].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawCollateralFromSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const pool = await this.getSinglePoolComet(cometIndex);
    const updatePricesIx = await this.updatePricesInstruction(pool.positions[0].poolIndex);
    const withdrawCollateralFromCometIx =
      await this.withdrawCollateralFromSinglePoolCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        cometIndex
      );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromCometIx),
      signers
    );
  }
  public async withdrawCollateralFromSinglePoolCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number
  ) {
    const { userPubkey, bump } = await this.getUserAddress();
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let singlePoolComet = await this.getSinglePoolComet(cometIndex);

    return (await this.program.instruction.withdrawCollateralFromComet(
      this.managerAddress[1],
      bump,
      0,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          userAccount: userPubkey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          comet: cometAddress,
          vault:
            tokenData.collaterals[
              singlePoolComet.collaterals[0].collateralIndex
            ].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addLiquidityToSinglePoolComet(
    usdiAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addLiquidityToSinglePoolCometIx =
      await this.addLiquidityToSinglePoolCometInstruction(
        usdiAmount,
        cometIndex
      );
    await this.provider.send(
      new Transaction()
        .add(updatePricesIx)
        .add(addLiquidityToSinglePoolCometIx),
      signers
    );
  }
  public async addLiquidityToSinglePoolCometInstruction(
    usdiAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let singlePoolComet = await this.getSinglePoolComet(cometIndex);
    let position = singlePoolComet.positions[0];

    return (await this.program.instruction.addLiquidityToComet(
      this.managerAddress[1],
      position.poolIndex,
      usdiAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
          comet: cometAddress,
          ammUsdiTokenAccount:
            tokenData.pools[position.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[position.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[position.poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[position.poolIndex].cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawLiquidityFromSinglePoolComet(
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityFromSinglePoolCometIx =
      await this.withdrawLiquidityFromSinglePoolCometInstruction(
        userIassetTokenAccount,
        userUsdiTokenAccount,
        liquidityTokenAmount,
        cometIndex
      );
    await this.provider.send(
      new Transaction().add(withdrawLiquidityFromSinglePoolCometIx),
      signers
    );
  }
  public async withdrawLiquidityFromSinglePoolCometInstruction(
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let singlePoolComet = await this.getSinglePoolComet(cometIndex);
    let position = singlePoolComet.positions[0];

    return (await this.program.instruction.withdrawLiquidityFromComet(
      this.managerAddress[1],
      0,
      liquidityTokenAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
          comet: cometAddress,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[position.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[position.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[position.poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[position.poolIndex].cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async recenterSinglePoolComet(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const recenterSingleCometIx = await this.recenterSingleCometInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      cometIndex
    );
    await this.provider.send(
      new Transaction().add(recenterSingleCometIx),
      signers
    );
  }
  public async recenterSingleCometInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let comet = await this.getSinglePoolComet(cometIndex);
    let position = comet.positions[0];

    return (await this.program.instruction.recenterComet(
      this.managerAddress[1],
      0,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          comet: cometAddress,
          ammUsdiTokenAccount:
            tokenData.pools[position.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[position.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[position.poolIndex].liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async partialRecenterSinglePoolComet(
    debtAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const recenterSingleCometIx =
      await this.partialRecenterSinglePoolCometInstruction(
        debtAmount,
        userUsdiTokenAccount,
        userIassetTokenAccount,
        cometIndex
      );
    await this.provider.send(
      new Transaction().add(recenterSingleCometIx),
      signers
    );
  }
  public async partialRecenterSinglePoolCometInstruction(
    debtAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let comet = await this.getSinglePoolComet(cometIndex);
    let position = comet.positions[0];

    return (await this.program.instruction.partialRecenterComet(
      this.managerAddress[1],
      0,
      debtAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          comet: cometAddress,
          ammUsdiTokenAccount:
            tokenData.pools[position.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[position.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[position.poolIndex].liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async paySinglePoolCometILD(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const paySinglePoolCometILDIx = await this.paySinglePoolCometILDInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      cometIndex
    );
    await this.provider.send(
      new Transaction().add(paySinglePoolCometILDIx),
      signers
    );
  }
  public async paySinglePoolCometILDInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let cometAddress = (await this.getSinglePoolComets()).comets[cometIndex];
    let comet = await this.getSinglePoolComet(cometIndex);
    let position = comet.positions[0];

    return (await this.program.instruction.payCometImpermanentLossDebt(
      this.managerAddress[1],
      0,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          comet: cometAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawLiquidityAndPaySinglePoolCometILD(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    let singlePoolComet = await this.getSinglePoolComet(cometIndex);
    if (Number(singlePoolComet.numPositions) == 0) {
      return;
    }
    if (toScaledNumber(singlePoolComet.positions[0].liquidityTokenValue) != 0) {
      const withdrawLiquidityFromSinglePoolCometIx =
        await this.withdrawLiquidityFromSinglePoolCometInstruction(
          userIassetTokenAccount,
          userUsdiTokenAccount,
          singlePoolComet.positions[0].liquidityTokenValue.val,
          cometIndex
        );
      const paySinglePoolCometILDIx =
        await this.paySinglePoolCometILDInstruction(
          userUsdiTokenAccount,
          userIassetTokenAccount,
          cometIndex
        );
      await this.provider.send(
        new Transaction()
          .add(withdrawLiquidityFromSinglePoolCometIx)
          .add(paySinglePoolCometILDIx),
        signers
      );
    } else {
      const paySinglePoolCometILDIx =
        await this.paySinglePoolCometILDInstruction(
          userUsdiTokenAccount,
          userIassetTokenAccount,
          cometIndex
        );
      await this.provider.send(
        new Transaction().add(paySinglePoolCometILDIx),
        signers
      );
    }
  }

  public async closeSinglePoolComet(
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const closeSinglePoolCometIx = await this.closeSinglePoolCometInstruction(
      cometIndex
    );
    await this.provider.send(
      new Transaction().add(closeSinglePoolCometIx),
      signers
    );
  }
  public async closeSinglePoolCometInstruction(cometIndex: number) {
    const { userPubkey, bump } = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let singlePoolComets = await this.getSinglePoolComets();

    return (await this.program.instruction.closeSinglePoolComet(
      bump,
      cometIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          userAccount: userPubkey,
          singlePoolComets: userAccount.singlePoolComets,
          singlePoolComet: singlePoolComets.comets[cometIndex],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawCollateralAndCloseSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    let singlePoolComet = await this.getSinglePoolComet(cometIndex);
    if (toScaledNumber(singlePoolComet.positions[0].liquidityTokenValue) != 0) {
      return;
    }
    if (Number(singlePoolComet.numCollaterals) != 0) {
      const withdrawCollateralFromSinglePoolCometIx =
        await this.withdrawCollateralFromSinglePoolCometInstruction(
          userCollateralTokenAccount,
          singlePoolComet.collaterals[0].collateralAmount.val,
          cometIndex
        );
      const closeSinglePoolCometIx = await this.closeSinglePoolCometInstruction(
        cometIndex
      );
      await this.provider.send(
        new Transaction()
          .add(withdrawCollateralFromSinglePoolCometIx)
          .add(closeSinglePoolCometIx),
        signers
      );
    } else {
      const closeSinglePoolCometIx = await this.closeSinglePoolCometInstruction(
        cometIndex
      );
      await this.provider.send(
        new Transaction().add(closeSinglePoolCometIx),
        signers
      );
    }
  }

  public async initializeCometManager(user = this.provider.wallet.publicKey) {
    const { userPubkey, bump } = await this.getUserAddress();

    const cometManagerAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeCometManager(
      this.managerAddress[1],
      bump,
      {
        accounts: {
          user: user,
          admin: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          userAccount: userPubkey,
          cometManager: cometManagerAccount.publicKey,
        },
        instructions: [
          await this.program.account.comet.createInstruction(
            cometManagerAccount,
            COMET_SIZE
          ),
        ],
        signers: [cometManagerAccount],
      }
    );
  }

  public async addCollateralToComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const addCollateralToCometIx = await this.addCollateralToCometInstruction(
      userCollateralTokenAccount,
      collateralAmount,
      collateralIndex,
      forManager
    );
    await this.provider.send(
      new Transaction().add(addCollateralToCometIx),
      signers
    );
  }

  public async initializeComet(user = this.provider.wallet.publicKey) {
    let { userPubkey, bump } = await this.getUserAddress();

    const cometAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeComet(bump, {
      accounts: {
        user: this.provider.wallet.publicKey,
        userAccount: userPubkey,
        comet: cometAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      instructions: [
        await this.program.account.comet.createInstruction(
          cometAccount,
          COMET_SIZE
        ),
      ],
      signers: [cometAccount],
    });
  }

  public async addCollateralToCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;

    return (await this.program.instruction.addCollateralToComet(
      this.managerAddress[1],
      collateralIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          comet: cometAddress,
          vault: tokenData.collaterals[collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawCollateralFromComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometCollateralIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromCometIx =
      await this.withdrawCollateralFromCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        cometCollateralIndex,
        forManager
      );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromCometIx),
      signers
    );
  }
  public async withdrawCollateralFromCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometCollateralIndex: number,
    forManager: boolean
  ) {
    const { userPubkey, bump } = await this.getUserAddress();
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let comet = await this.getComet(forManager);
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;

    return (await this.program.instruction.withdrawCollateralFromComet(
      this.managerAddress[1],
      bump,
      cometCollateralIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          userAccount: userPubkey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          comet: cometAddress,
          vault:
            tokenData.collaterals[
              comet.collaterals[cometCollateralIndex].collateralIndex
            ].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addLiquidityToComet(
    usdiAmount: BN,
    poolIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction(poolIndex);
    const addLiquidityToCometIx = await this.addLiquidityToCometInstruction(
      usdiAmount,
      poolIndex,
      forManager
    );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(addLiquidityToCometIx),
      signers
    );
  }
  public async addLiquidityToCometInstruction(
    usdiAmount: BN,
    poolIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;

    return (await this.program.instruction.addLiquidityToComet(
      this.managerAddress[1],
      poolIndex,
      usdiAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
          comet: cometAddress,
          ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
          ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
          liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[poolIndex].cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawLiquidityFromComet(
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityFromCometIx =
      await this.withdrawLiquidityFromCometInstruction(
        userIassetTokenAccount,
        userUsdiTokenAccount,
        liquidityTokenAmount,
        cometPositionIndex,
        forManager
      );
    await this.provider.send(
      new Transaction().add(withdrawLiquidityFromCometIx),
      signers
    );
  }
  public async withdrawLiquidityFromCometInstruction(
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let position = comet.positions[cometPositionIndex];

    return (await this.program.instruction.withdrawLiquidityFromComet(
      this.managerAddress[1],
      cometPositionIndex,
      liquidityTokenAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
          comet: cometAddress,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[position.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[position.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[position.poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[position.poolIndex].cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async recenterComet(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const recenterCometIx = await this.recenterCometInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      cometPositionIndex,
      forManager
    );
    await this.provider.send(new Transaction().add(recenterCometIx), signers);
  }
  public async recenterCometInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let cometPosition = comet.positions[cometPositionIndex];

    return (await this.program.instruction.recenterComet(
      this.managerAddress[1],
      cometPositionIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          comet: cometAddress,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async partialRecenterComet(
    debtAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const recenterCometIx = await this.partialRecenterCometInstruction(
      debtAmount,
      userUsdiTokenAccount,
      userIassetTokenAccount,
      cometPositionIndex,
      forManager
    );
    await this.provider.send(new Transaction().add(recenterCometIx), signers);
  }
  public async partialRecenterCometInstruction(
    debtAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let cometPosition = comet.positions[cometPositionIndex];

    return (await this.program.instruction.partialRecenterComet(
      this.managerAddress[1],
      cometPositionIndex,
      debtAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          comet: cometAddress,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async payCometILD(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const payCometILDIx = await this.payCometILDInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      cometPositionIndex,
      forManager
    );
    await this.provider.send(new Transaction().add(payCometILDIx), signers);
  }
  public async payCometILDInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let cometPosition = comet.positions[cometPositionIndex];

    return (await this.program.instruction.payCometImpermanentLossDebt(
      this.managerAddress[1],
      cometPositionIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          comet: cometAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawLiquidityAndPayCometILD(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometPositionIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    let comet = await this.getComet();
    if (Number(comet.numPositions) == 0) {
      return;
    }
    let cometPosition = comet.positions[cometPositionIndex];
    if (toScaledNumber(cometPosition.liquidityTokenValue) != 0) {
      const withdrawLiquidityFromCometIx =
        await this.withdrawLiquidityFromCometInstruction(
          userIassetTokenAccount,
          userUsdiTokenAccount,
          cometPosition.liquidityTokenValue.val,
          cometPositionIndex,
          forManager
        );
      const payCometILDIx = await this.payCometILDInstruction(
        userUsdiTokenAccount,
        userIassetTokenAccount,
        cometPositionIndex,
        forManager
      );
      await this.provider.send(
        new Transaction().add(withdrawLiquidityFromCometIx).add(payCometILDIx),
        signers
      );
    } else {
      const payCometILDIx = await this.payCometILDInstruction(
        userUsdiTokenAccount,
        userIassetTokenAccount,
        cometPositionIndex,
        forManager
      );
      await this.provider.send(new Transaction().add(payCometILDIx), signers);
    }
  }

  // Hackathon ONLY!
  public async hackathonMintUsdiInstruction(
    userUsdiTokenAccount: PublicKey,
    amount: number
  ) {
    return this.program.instruction.mintUsdiHackathon(
      this.managerAddress[1],
      new BN(amount),
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          usdiMint: this.manager!.usdiMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async getOrCreateUsdiAssociatedTokenAccount() {
    return await this.getOrCreateAssociatedTokenAccount(this.manager!.usdiMint);
  }

  public async getOrCreateAssociatedTokenAccount(mint: PublicKey) {
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      this.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let account;
    try {
      account = await getAccount(
        this.connection,
        associatedToken,
        "recent",
        TOKEN_PROGRAM_ID
      );
    } catch (error: unknown) {
      if (error instanceof TokenAccountNotFoundError) {
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            this.provider.wallet.publicKey,
            associatedToken,
            this.provider.wallet.publicKey,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );

        await this.provider.send(transaction);
        await sleep(200);
        account = await getAccount(
          this.connection,
          associatedToken,
          "recent",
          TOKEN_PROGRAM_ID
        );
      } else {
        throw error;
      }
    }

    if (!account) {
      throw Error("Could not create account!");
    }
    return account;
  }

  public async hackathonMintUsdi(
    userUsdiTokenAccount: PublicKey,
    amount: number
  ) {
    const mintUsdiTx = await this.hackathonMintUsdiInstruction(
      userUsdiTokenAccount,
      amount
    );
    await this.provider.send(new Transaction().add(mintUsdiTx));
  }

  public async liquidateMintPosition(
    liquidateAccount: PublicKey,
    liquidateAccountBump: number,
    mintIndex: number
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const liquidateMintTx = await this.liquidateMintPositionInstruction(
      liquidateAccount,
      liquidateAccountBump,
      mintIndex
    );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(liquidateMintTx)
    );
  }

  public async liquidateMintPositionInstruction(
    liquidateAccount: PublicKey,
    liquidateAccountBump: number,
    mintIndex: number
  ) {
    const userAccount = await this.getUserAccount(liquidateAccount);
    const tokenData = await this.getTokenData();

    const mintPosition = await this.getMintPosition(mintIndex);
    const pool = tokenData.pools[mintPosition.poolIndex];
    const collateral = tokenData.collaterals[mintPosition.collateralIndex];

    const liquidatorCollateralTokenAccount =
      await this.getOrCreateAssociatedTokenAccount(collateral.mint);
    const liquidatoriAssetTokenAccount =
      await this.getOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

    return this.program.instruction.liquidateMintPosition(
      this.managerAddress[1],
      liquidateAccountBump,
      mintIndex,
      {
        accounts: {
          liquidator: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          userAccount: liquidateAccount,
          user: liquidateAccount,
          iassetMint: pool.assetInfo.iassetMint,
          mintPositions: userAccount.mintPositions,
          vault: collateral.vault,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidatorCollateralTokenAccount:
            liquidatorCollateralTokenAccount.address,
          liquidatorIassetTokenAccount: liquidatoriAssetTokenAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async getiAssetInfo(walletAddress?: PublicKey) {
    const mints = await this.getiAssetMints();
    const iassetInfo = [];
    let i = 0;
    for (var mint of mints) {
      let poolBalances = await this.getPoolBalances(i);
      let price = poolBalances[1] / poolBalances[0];
      iassetInfo.push([i, price]);
      i++;
    }
    return iassetInfo;
  }

  public async getiAssetMints() {
    const tokenData = await this.getTokenData();
    let mints: PublicKey[] = [];
    let index = 0;
    for (const pool of tokenData.pools) {
      if (index === Number(tokenData.numPools)) {
        break;
      }
      mints.push(pool.assetInfo.iassetMint);
      index++;
    }
    return mints;
  }

  public async getMintiAssetData(index: number) {
    let assetInfo = await this.getAssetInfo(index);
    let associatedTokenAddress = (
      await this.getOrCreateAssociatedTokenAccount(assetInfo.iassetMint)
    ).address;
    let amount = (
      await this.connection.getTokenAccountBalance(
        associatedTokenAddress,
        "confirmed"
      )
    ).value!.uiAmount;
    return [
      toScaledNumber(assetInfo.price),
      Number(assetInfo.stableCollateralRatio.val),
      Number(assetInfo.cryptoCollateralRatio.val),
      amount,
    ];
  }

  public async getUseriAssetInfo() {
    const mints = await this.getiAssetMints();
    const userInfo = [];
    let i = 0;
    for (var mint of mints) {
      let associatedTokenAddress = (
        await PublicKey.findProgramAddress(
          [
            this.provider.wallet.publicKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
          ],
          SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
        )
      )[0];
      let amount;
      try {
        amount = (
          await this.connection.getTokenAccountBalance(
            associatedTokenAddress,
            "confirmed"
          )
        ).value!.uiAmount;
      } catch {
        amount = 0;
      }

      if (amount !== null && amount > 0) {
        let poolBalances = await this.getPoolBalances(i);
        let price = poolBalances[1] / poolBalances[0];
        userInfo.push([i, price, amount]);
      }
      i++;
    }
    return userInfo;
  }

  public async getUserMintInfos() {
    let mintPositions;
    try {
      mintPositions = await this.getMintPositions();
    } catch (error) {
      if (error instanceof MintPositionsUninitialized) {
        return [];
      }
      throw error;
    }

    const mintInfos = [];
    for (let i = 0; i < Number(mintPositions.numPositions); i++) {
      let mintPosition = mintPositions.mintPositions[i];
      let poolIndex = mintPosition.poolIndex;
      let collateralIndex = mintPosition.collateralIndex;
      let assetInfo = await this.getAssetInfo(poolIndex);
      let collateral = await this.getCollateral(collateralIndex);
      let collateralAmount = mintPosition.collateralAmount;
      let price = assetInfo.price;
      let borrowedIasset = mintPosition.borrowedIasset;
      let collateralRatio: Value;
      let minCollateralRatio: Value;
      if (collateral.stable) {
        collateralRatio = div(collateralAmount, mul(price, borrowedIasset));
        minCollateralRatio = assetInfo.stableCollateralRatio;
      } else {
        let collateralAssetInfo = await this.getAssetInfo(collateral.poolIndex);
        let collateralPrice = collateralAssetInfo.price;
        let collateralAmount = mintPosition.collateralAmount;
        collateralRatio = div(
          mul(collateralPrice, collateralAmount),
          mul(price, borrowedIasset)
        );
        minCollateralRatio = assetInfo.cryptoCollateralRatio;
      }
      mintInfos.push([
        poolIndex,
        collateralIndex,
        toScaledNumber(price),
        toScaledNumber(borrowedIasset),
        toScaledNumber(collateralAmount),
        toScaledPercent(collateralRatio),
        toScaledPercent(minCollateralRatio),
      ]);
    }
    return mintInfos;
  }

  public async getUserMintInfo(index: number) {
    const mintPositions = await this.getMintPositions();
    let mintPosition = mintPositions.mintPositions[index];
    let poolIndex = mintPosition.poolIndex;
    let collateralIndex = mintPosition.collateralIndex;
    let assetInfo = await this.getAssetInfo(poolIndex);
    let collateral = await this.getCollateral(collateralIndex);
    let collateralAmount = mintPosition.collateralAmount;
    let price = assetInfo.price;
    let borrowedIasset = mintPosition.borrowedIasset;
    let collateralRatio: Value;
    let minCollateralRatio: Value;
    if (collateral.stable) {
      collateralRatio = div(collateralAmount, mul(price, borrowedIasset));
      minCollateralRatio = assetInfo.stableCollateralRatio;
    } else {
      let collateralAssetInfo = await this.getAssetInfo(collateral.poolIndex);
      let collateralPrice = collateralAssetInfo.price;
      let collateralAmount = mintPosition.collateralAmount;
      collateralRatio = div(
        mul(collateralPrice, collateralAmount),
        mul(price, borrowedIasset)
      );
      minCollateralRatio = assetInfo.cryptoCollateralRatio;
    }
    return [
      toScaledNumber(borrowedIasset),
      toScaledNumber(collateralAmount),
      toScaledPercent(collateralRatio),
      toScaledPercent(minCollateralRatio),
    ];
  }

  public async getUserLiquidityInfos() {
    const liquidityPositions = await this.getLiquidityPositions();
    const liquidityInfos = [];
    for (let i = 0; i < Number(liquidityPositions.numPositions); i++) {
      let liquidityPosition = liquidityPositions.liquidityPositions[i];
      let poolIndex = liquidityPosition.poolIndex;
      let pool = await this.getPool(poolIndex);
      let poolBalances = await this.getPoolBalances(poolIndex);
      let price = poolBalances[1] / poolBalances[0];
      let liquidityTokenAmount = toScaledNumber(
        liquidityPosition.liquidityTokenValue
      );
      let liquidityTokenSupply = (
        await this.connection.getTokenSupply(pool.liquidityTokenMint)
      ).value!.uiAmount;
      if (liquidityTokenSupply === null) {
        throw new Error("Couldn't get token supply");
      }
      let iassetValue =
        (poolBalances[0] * liquidityTokenAmount) / liquidityTokenSupply;
      let usdiValue =
        (poolBalances[1] * liquidityTokenAmount) / liquidityTokenSupply;
      liquidityInfos.push([
        poolIndex,
        price,
        iassetValue,
        usdiValue,
        liquidityTokenAmount,
      ]);
    }
    return liquidityInfos;
  }

  public async getUserSinglePoolCometInfos() {
    let singlePoolComets;
    let cometInfos: any[] = [];
    try {
      singlePoolComets = await this.getSinglePoolComets();
    } catch (error) {
      if (error instanceof SinglePoolCometUninitialized) {
        return cometInfos;
      }
      throw error;
    }

    for (let i = 0; i < Number(singlePoolComets.numComets); i++) {
      let singlePoolComet = await this.getSinglePoolComet(i);
      let cometPosition = singlePoolComet.positions[0];
      let poolIndex = cometPosition.poolIndex;
      let pool = await this.getPool(poolIndex);
      let collateralIndex = singlePoolComet.collaterals[0].collateralIndex;
      let assetInfo = await this.getAssetInfo(poolIndex);
      let poolBalances = await this.getPoolBalances(poolIndex);
      let ammPrice = poolBalances[1] / poolBalances[0];
      let oraclePrice = toScaledNumber(assetInfo.price);
      let borrowedIasset = toScaledNumber(cometPosition.borrowedIasset);
      let borrowedUsdi = toScaledNumber(cometPosition.borrowedIasset);
      let totalCollateralAmount = toScaledNumber(
        singlePoolComet.totalCollateralAmount
      );
      let data = await this.calculateEditCometSinglePoolWithUsdiBorrowed(
        i,
        0,
        0
      );
      let range = [data.lowerPrice, data.upperPrice];
      let lowerPriceRange = range[0];
      let upperPriceRange = range[1];
      let minGap = Math.min(
        oraclePrice - lowerPriceRange,
        ammPrice - lowerPriceRange,
        upperPriceRange - oraclePrice,
        upperPriceRange - ammPrice
      );
      let indicatorPrice: number;
      switch (minGap) {
        case oraclePrice - lowerPriceRange:
          indicatorPrice = oraclePrice;
          break;
        case ammPrice - lowerPriceRange:
          indicatorPrice = ammPrice;
          break;
        case upperPriceRange - oraclePrice:
          indicatorPrice = oraclePrice;
          break;
        case upperPriceRange - ammPrice:
          indicatorPrice = ammPrice;
          break;
        default:
          throw new Error("Not supported");
      }
      let centerPrice =
        toScaledNumber(cometPosition.borrowedUsdi) /
        toScaledNumber(cometPosition.borrowedIasset);

      let liquidityTokenAmount = toScaledNumber(
        cometPosition.liquidityTokenValue
      );
      let liquidityTokenSupply = (
        await this.connection.getTokenSupply(pool.liquidityTokenMint)
      ).value!.uiAmount;
      if (liquidityTokenSupply === null) {
        throw new Error("Couldn't get token supply");
      }
      let iassetValue =
        (poolBalances[0] * liquidityTokenAmount) / liquidityTokenSupply;
      let usdiValue =
        (poolBalances[0] * liquidityTokenAmount) / liquidityTokenSupply;
      let ildIsIasset: boolean;
      let ild: number;
      if (borrowedIasset > iassetValue) {
        ildIsIasset = true;
        ild = borrowedIasset - iassetValue;
      } else if (borrowedUsdi > usdiValue) {
        ildIsIasset = false;
        ild = borrowedUsdi - usdiValue;
      } else {
        ildIsIasset = false;
        ild = 0;
      }
      cometInfos.push([
        poolIndex,
        collateralIndex,
        indicatorPrice,
        centerPrice,
        lowerPriceRange,
        upperPriceRange,
        totalCollateralAmount,
        ildIsIasset,
        ild,
        borrowedIasset,
        borrowedUsdi,
        liquidityTokenAmount,
      ]);
    }
    return cometInfos;
  }

  public async getiAssetInfos() {
    const iassetInfo = [];
    for (let i = 0; i < Number((await this.getTokenData()).numPools); i++) {
      let poolBalances = await this.getPoolBalances(i);
      let price = poolBalances[1] / poolBalances[0];
      let liquidity = poolBalances[1] * 2;
      iassetInfo.push([i, price, liquidity]);
    }
    return iassetInfo;
  }

  public async updateILHealthScoreCoefficient(coefficient: number) {
    const [pubKey, bump] = await this.getManagerAddress();

    await this.program.rpc.updateIlHealthScoreCoefficient(
      bump,
      toDevnetScale(coefficient),
      {
        accounts: {
          admin: this.provider.wallet.publicKey,
          manager: pubKey,
          tokenData: this.manager!.tokenData,
        },
      }
    );
  }

  public async updatePoolHealthScoreCoefficient(
    coefficient: number,
    poolIndex: number
  ) {
    const [pubKey, bump] = await this.getManagerAddress();

    await this.program.rpc.updatePoolHealthScoreCoefficient(
      bump,
      poolIndex,
      toDevnetScale(coefficient),
      {
        accounts: {
          admin: this.provider.wallet.publicKey,
          manager: pubKey,
          tokenData: this.manager!.tokenData,
        },
      }
    );
  }

  public async getHealthScore() {
    const tokenData = await this.getTokenData();
    const comet = await this.getComet();

    const totalCollateralAmount = toScaledNumber(comet.totalCollateralAmount);

    const loss =
      comet.positions
        .slice(0, Number(comet.numPositions))
        .map((position) => {
          let pool = tokenData.pools[position.poolIndex];
          let poolUsdiAmount = toScaledNumber(pool.usdiAmount);
          let poolIassetAmount = toScaledNumber(pool.iassetAmount);
          let poolPrice = poolUsdiAmount / poolIassetAmount;
          let borrowedUsdi = toScaledNumber(position.borrowedUsdi);
          let borrowedIasset = toScaledNumber(position.borrowedIasset);

          let initPrice = borrowedUsdi / borrowedIasset;

          let claimableRatio =
            toScaledNumber(position.liquidityTokenValue) /
            toScaledNumber(pool.liquidityTokenSupply);

          let claimableUsdi = poolUsdiAmount * claimableRatio;
          let claimableIasset = poolIassetAmount * claimableRatio;

          let ilHealthScoreCoefficient = toScaledNumber(
            tokenData.ilHealthScoreCoefficient
          );
          let poolHealthScoreCoefficient = toScaledNumber(
            pool.assetInfo.healthScoreCoefficient
          );
          let markPrice = Math.max(
            toScaledNumber(pool.assetInfo.price),
            poolPrice
          );

          let ilHealthImpact = 0;

          if (borrowedUsdi === 0 || borrowedIasset === 0) {
            ilHealthImpact = borrowedUsdi
              ? borrowedUsdi
              : borrowedIasset * markPrice * ilHealthScoreCoefficient;
          } else if (poolPrice < initPrice) {
            ilHealthImpact =
              (borrowedUsdi - claimableUsdi) * ilHealthScoreCoefficient;
          } else if (initPrice < poolPrice) {
            ilHealthImpact =
              markPrice *
              (borrowedIasset - claimableIasset) *
              ilHealthScoreCoefficient;
          }
          let positionHealthImpact = poolHealthScoreCoefficient * borrowedUsdi;

          return positionHealthImpact + ilHealthImpact;
        })
        .reduce((partialSum, a) => partialSum + a, 0) / totalCollateralAmount;

    return 100 - loss;
  }

  public async getSinglePoolHealthScore(
    cometIndex: number
  ): Promise<{ healthScore: number; ILD: number; ildInUsdi: boolean }> {
    const tokenData = await this.getTokenData();
    const comet = await this.getSinglePoolComet(cometIndex);

    let position = comet.positions[0];
    let pool = tokenData.pools[position.poolIndex];
    let poolUsdiAmount = toScaledNumber(pool.usdiAmount);
    let poolIassetAmount = toScaledNumber(pool.iassetAmount);
    let poolPrice = poolUsdiAmount / poolIassetAmount;
    let borrowedUsdi = toScaledNumber(position.borrowedUsdi);
    let borrowedIasset = toScaledNumber(position.borrowedIasset);
    let initPrice = borrowedUsdi / borrowedIasset;

    let claimableRatio =
      toScaledNumber(position.liquidityTokenValue) /
      toScaledNumber(pool.liquidityTokenSupply);

    let markPrice = Math.max(toScaledNumber(pool.assetInfo.price), poolPrice);

    let claimableUsdi = poolUsdiAmount * claimableRatio;
    let claimableIasset = poolIassetAmount * claimableRatio;
    let ILD = 0;
    let isUsdi = false;
    if (initPrice < poolPrice) {
      ILD += (borrowedIasset - claimableIasset) * markPrice;
    } else if (poolPrice < initPrice) {
      ILD += borrowedUsdi - claimableUsdi;
      isUsdi = true;
    }

    const ilCoefficient = toScaledNumber(tokenData.ilHealthScoreCoefficient);
    const assetCoefficient = toScaledNumber(
      tokenData.pools[position.poolIndex].assetInfo.healthScoreCoefficient
    );
    let totalLoss = ilCoefficient * ILD + assetCoefficient * borrowedUsdi;
    const healthScore =
      100 - totalLoss / toScaledNumber(comet.totalCollateralAmount);

    return { healthScore: healthScore, ILD: ILD, ildInUsdi: isUsdi };
  }

  public async getSinglePoolILD(
    cometIndex: number
  ): Promise<{ ILD: number; ildInUsdi: boolean }> {
    const tokenData = await this.getTokenData();
    const comet = await this.getSinglePoolComet(cometIndex);

    let position = comet.positions[0];
    let pool = tokenData.pools[position.poolIndex];
    let poolUsdiAmount = toScaledNumber(pool.usdiAmount);
    let poolIassetAmount = toScaledNumber(pool.iassetAmount);
    let poolPrice = poolUsdiAmount / poolIassetAmount;
    let borrowedUsdi = toScaledNumber(position.borrowedUsdi);
    let borrowedIasset = toScaledNumber(position.borrowedIasset);
    let initPrice = borrowedUsdi / borrowedIasset;

    let claimableRatio =
      toScaledNumber(position.liquidityTokenValue) /
      toScaledNumber(pool.liquidityTokenSupply);

    let markPrice = Math.max(toScaledNumber(pool.assetInfo.price), poolPrice);

    let claimableUsdi = poolUsdiAmount * claimableRatio;
    let claimableIasset = poolIassetAmount * claimableRatio;
    let ILD = 0;
    let isUsdi = false;
    if (initPrice < poolPrice) {
      ILD += (borrowedIasset - claimableIasset) * markPrice;
    } else if (poolPrice < initPrice) {
      ILD += borrowedUsdi - claimableUsdi;
      isUsdi = true;
    }

    return { ILD: ILD, ildInUsdi: isUsdi };
  }

  public async getILD(
    poolIndex?: number
  ): Promise<{ isUsdi: boolean; ILD: number; poolIndex: number }[]> {
    const tokenData = await this.getTokenData();
    const comet = await this.getComet();

    let results: { isUsdi: boolean; ILD: number; poolIndex: number }[] = [];

    comet.positions.slice(0, Number(comet.numPositions)).forEach((position) => {
      if (poolIndex !== undefined && poolIndex !== Number(position.poolIndex)) {
        return;
      }

      let pool = tokenData.pools[position.poolIndex];
      let poolUsdiAmount = toScaledNumber(pool.usdiAmount);
      let poolIassetAmount = toScaledNumber(pool.iassetAmount);
      let poolPrice = poolUsdiAmount / poolIassetAmount;

      let borrowedUsdi = toScaledNumber(position.borrowedUsdi);
      let borrowedIasset = toScaledNumber(position.borrowedIasset);
      let initPrice = borrowedUsdi / borrowedIasset;

      let claimableRatio =
        toScaledNumber(position.liquidityTokenValue) /
        toScaledNumber(pool.liquidityTokenSupply);

      let claimableUsdi = poolUsdiAmount * claimableRatio;
      let claimableIasset = poolIassetAmount * claimableRatio;
      let ILD = 0;
      let isUsdi = false;
      if (poolPrice < initPrice) {
        ILD += borrowedUsdi - claimableUsdi;
        isUsdi = true;
      } else if (initPrice < poolPrice) {
        ILD += borrowedIasset - claimableIasset;
      }

      results.push({ isUsdi: isUsdi, ILD: ILD, poolIndex: position.poolIndex });
    });

    return results;
  }

  public async liquidateCometPositionReductionInstruction(
    liquidateeAddress: PublicKey,
    positionIndex: number,
    reductionAmount: number
  ) {
    const { userPubkey, bump } = await this.getUserAddress(liquidateeAddress);
    let userAccount = await this.getUserAccount(userPubkey);
    let comet = await this.getComet(false, userPubkey);
    let position = comet.positions[positionIndex];
    let tokenData = await this.getTokenData();
    let pool = tokenData.pools[position.poolIndex];
    const liquidatorUsdiTokenAccount =
      await this.getOrCreateAssociatedTokenAccount(this.manager!.usdiMint);
    const liquidatoriAssetTokenAccount =
      await this.getOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

    return await this.program.instruction.liquidateCometPositionReduction(
      this.managerAddress[1],
      bump,
      positionIndex,
      toDevnetScale(reductionAmount),
      {
        accounts: {
          liquidator: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          user: liquidateeAddress,
          userAccount: userPubkey,
          comet: userAccount.comet,
          usdiMint: this.manager!.usdiMint,
          iassetMint: pool.assetInfo.iassetMint,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidityTokenMint: pool.liquidityTokenMint,
          cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
          liquidatorUsdiTokenAccount: liquidatorUsdiTokenAccount.address,
          liquidatorIassetTokenAccount: liquidatoriAssetTokenAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async liquidateCometPositionReduction(
    liquidateeAddress: PublicKey,
    positionIndex: number,
    reductionAmount: number
  ) {
    let updatePricesIx = await this.updatePricesInstruction();

    let ix = await this.liquidateCometPositionReductionInstruction(
      liquidateeAddress,
      positionIndex,
      reductionAmount
    );
    return await this.provider.send(
      new Transaction().add(updatePricesIx).add(ix)
    );
  }

  public async liquidateCometPositionILInstruction(
    liquidateeAddress: PublicKey,
    positionIndex: number,
    usdiCometCollateralIndex: number,
    reductionAmount: number
  ) {
    const { userPubkey, bump } = await this.getUserAddress(liquidateeAddress);
    let userAccount = await this.getUserAccount(userPubkey);
    let comet = await this.getComet(false, userPubkey);
    let position = comet.positions[positionIndex];
    let tokenData = await this.getTokenData();
    let pool = tokenData.pools[position.poolIndex];
    let usdiCollateralIndex =
      comet.collaterals[usdiCometCollateralIndex].collateralIndex;
    let usdiCollateral = tokenData.collaterals[usdiCollateralIndex];
    const liquidatorUsdiTokenAccount =
      await this.getOrCreateAssociatedTokenAccount(this.manager!.usdiMint);

    return await this.program.instruction.liquidateCometIlReduction(
      this.managerAddress[1],
      bump,
      positionIndex,
      usdiCometCollateralIndex,
      toDevnetScale(reductionAmount),
      {
        accounts: {
          liquidator: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager!.tokenData,
          user: liquidateeAddress,
          userAccount: userPubkey,
          comet: userAccount.comet,
          usdiMint: this.manager!.usdiMint,
          vault: usdiCollateral.vault,
          iassetMint: pool.assetInfo.iassetMint,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidityTokenMint: pool.liquidityTokenMint,
          cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
          liquidatorUsdiTokenAccount: liquidatorUsdiTokenAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async liquidateCometILReduction(
    liquidateeAddress: PublicKey,
    positionIndex: number,
    usdiCometCollateralIndex: number,
    reductionAmount: number
  ) {
    let updatePricesIx = await this.updatePricesInstruction();
    let ix = await this.liquidateCometPositionILInstruction(
      liquidateeAddress,
      positionIndex,
      usdiCometCollateralIndex,
      reductionAmount
    );
    return await this.provider.send(
      new Transaction().add(updatePricesIx).add(ix)
    );
  }

  public async calculateNewSinglePoolCometFromUsdiBorrowed(
    poolIndex: number,
    collateralProvided: number,
    usdiBorrowed: number
  ): Promise<{
    healthScore: number;
    lowerPrice: number;
    upperPrice: number;
    maxUsdiPosition: number;
  }> {
    const tokenData = await this.getTokenData();
    const pool = tokenData.pools[poolIndex];

    const poolUsdi = toScaledNumber(pool.usdiAmount);
    const poolIasset = toScaledNumber(pool.iassetAmount);
    const poolPrice = poolUsdi / poolIasset;

    const iassetBorrowed = usdiBorrowed / poolPrice;

    const claimableRatio = usdiBorrowed / (usdiBorrowed + poolUsdi);

    const poolCoefficient = toScaledNumber(
      pool.assetInfo.healthScoreCoefficient
    );

    const loss = poolCoefficient * usdiBorrowed;

    const healhScore = 100 - loss / collateralProvided;

    const ilHealthScoreCoefficient = toScaledNumber(
      tokenData.ilHealthScoreCoefficient
    );

    const maxILD = (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

    const invariant = (poolUsdi + usdiBorrowed) * (poolIasset + iassetBorrowed);

    // Solution 1: Price goes down, IL is in USDi
    let y1 = Math.max((usdiBorrowed - maxILD) / claimableRatio, 0);
    const lowerPrice = (y1 * y1) / invariant;

    // Solution 2: Price goes up, IL is in iAsset
    let a = usdiBorrowed / poolPrice / invariant;
    let b = -claimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / invariant;

    let maxUsdiPosition = (100 * collateralProvided) / poolCoefficient;

    return {
      healthScore: healhScore,
      lowerPrice: lowerPrice,
      upperPrice: upperPrice,
      maxUsdiPosition: maxUsdiPosition,
    };
  }

  public async calculateNewSinglePoolCometFromRange(
    poolIndex: number,
    collateralProvided: number,
    price: number,
    isLowerPrice: boolean
  ): Promise<{
    healthScore: number;
    lowerPrice: number;
    upperPrice: number;
    usdiBorrowed: number;
    maxUsdiPosition: number;
  }> {
    const tokenData = await this.getTokenData();
    const pool = tokenData.pools[poolIndex];

    const poolUsdi = toScaledNumber(pool.usdiAmount);
    const poolIasset = toScaledNumber(pool.iassetAmount);
    const poolPrice = poolUsdi / poolIasset;

    const poolCoefficient = toScaledNumber(
      pool.assetInfo.healthScoreCoefficient
    );
    const ilHealthScoreCoefficient = toScaledNumber(
      tokenData.ilHealthScoreCoefficient
    );

    let maxUsdiPosition = (100 * collateralProvided) / poolCoefficient;

    const priceRange = (usdiBorrowed: number): number => {
      const claimableRatio = usdiBorrowed / (usdiBorrowed + poolUsdi);

      const loss = poolCoefficient * usdiBorrowed;

      const healthScore = 100 - loss / collateralProvided;

      const maxILD =
        (100 * collateralProvided - loss) / ilHealthScoreCoefficient;

      const iassetBorrowed = usdiBorrowed / poolPrice;

      const invariant =
        (poolUsdi + usdiBorrowed) * (poolIasset + iassetBorrowed);

      // Solution 1: Price goes down, IL is in USDi
      let y1 = Math.max((usdiBorrowed - maxILD) / claimableRatio, 0);
      const lowerPrice = (y1 * y1) / invariant;
      // Solution 2: Price goes up, IL is in iAsset
      let a = usdiBorrowed / poolPrice / invariant;
      let b = -claimableRatio;
      let c = -maxILD;
      let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      const upperPrice = (y2 * y2) / invariant;

      return isLowerPrice ? lowerPrice : upperPrice;
    };

    let maxIter = 1000;
    let tolerance = 1e-9;
    let startSearch = 0;
    let stopSearch = maxUsdiPosition;
    let positionGuess = (startSearch + stopSearch) * 0.5;
    let iter = 0;
    let range = priceRange(positionGuess);
    while (iter < maxIter) {
      positionGuess = (startSearch + stopSearch) * 0.5;

      let estPrice = priceRange(positionGuess);

      if (isLowerPrice) {
        let diff = estPrice - price;
        if (Math.abs(diff) < tolerance) {
          break;
        }

        if (diff < 0) {
          // Increase position to increase lower
          startSearch = positionGuess;
        } else {
          stopSearch = positionGuess;
        }
      } else {
        let diff = estPrice - price;
        if (Math.abs(diff) < tolerance) {
          break;
        }

        if (diff < 0) {
          // Reduce position to increase upper
          stopSearch = positionGuess;
        } else {
          startSearch = positionGuess;
        }
      }
      iter += 1;
    }

    if (iter === maxIter) {
      throw new CalculationError("Max iterations reached!");
    }

    const results = await this.calculateNewSinglePoolCometFromUsdiBorrowed(
      poolIndex,
      collateralProvided,
      positionGuess
    );

    return { ...results, usdiBorrowed: positionGuess };
  }

  public async calculateEditCometSinglePoolWithUsdiBorrowed(
    cometIndex: number,
    collateralChange: number,
    usdiBorrowedChange: number
  ): Promise<{
    maxCollateralWithdrawable: number;
    maxUsdiPosition: number;
    healthScore: number;
    lowerPrice: number;
    upperPrice: number;
  }> {
    const tokenData = await this.getTokenData();
    const comet = await this.getSinglePoolComet(cometIndex);
    const position = comet.positions[0];
    const pool = tokenData.pools[position.poolIndex];

    let lpTokens = toScaledNumber(position.liquidityTokenValue);
    let positionBorrowedUsdi = toScaledNumber(position.borrowedUsdi);
    let positionBorrowedIasset = toScaledNumber(position.borrowedIasset);
    const poolUsdi = toScaledNumber(pool.usdiAmount);
    const poolIasset = toScaledNumber(pool.iassetAmount);
    const poolLpTokens = toScaledNumber(pool.liquidityTokenSupply);
    const claimableRatio = lpTokens / poolLpTokens;

    const poolPrice = poolUsdi / poolIasset;
    const iassetBorrowedChange = usdiBorrowedChange / poolPrice;

    let markPrice = Math.max(toScaledNumber(pool.assetInfo.price), poolPrice);
    let newClaimableRatio = claimableRatio;
    // Calculate total lp tokens
    if (usdiBorrowedChange > 0) {
      newClaimableRatio += usdiBorrowedChange / (usdiBorrowedChange + poolUsdi);
    } else if (usdiBorrowedChange < 0) {
      const claimableUsdi = claimableRatio * poolUsdi;
      const newLpTokens =
        (lpTokens * (positionBorrowedUsdi + usdiBorrowedChange)) /
        claimableUsdi;
      newClaimableRatio = newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
    }
    positionBorrowedUsdi += usdiBorrowedChange;
    positionBorrowedIasset += iassetBorrowedChange;

    const currentCollateral = toScaledNumber(comet.totalCollateralAmount);
    let newCollateralAmount = currentCollateral + collateralChange;

    let newInitPrice = positionBorrowedUsdi / positionBorrowedIasset;
    let newPoolUsdi = poolUsdi + usdiBorrowedChange;
    let newPooliAsset = poolIasset + iassetBorrowedChange;

    let ILD = 0;
    let epsilon = Math.pow(10, -DEVNET_TOKEN_SCALE);
    if (poolPrice - newInitPrice > epsilon) {
      // IL in iAsset
      ILD +=
        (positionBorrowedIasset - newClaimableRatio * newPooliAsset) *
        markPrice;
    } else if (newInitPrice - poolPrice > epsilon) {
      ILD += positionBorrowedUsdi - newClaimableRatio * newPoolUsdi;
    }

    const ilHealthScoreCoefficient = toScaledNumber(
      tokenData.ilHealthScoreCoefficient
    );
    const poolCoefficient = toScaledNumber(
      pool.assetInfo.healthScoreCoefficient
    );

    const ILDloss = ilHealthScoreCoefficient * ILD;
    const positionLoss = poolCoefficient * positionBorrowedUsdi;
    const loss = ILDloss + positionLoss;

    const newHealthScore = 100 - loss / newCollateralAmount;
    const maxCollateralWithdrawable = currentCollateral - loss / 100;

    const maxILD =
      (100 * newCollateralAmount - positionLoss) / ilHealthScoreCoefficient;

    const newInvariant = newPoolUsdi * newPooliAsset;

    // Solution 1: Price goes down, IL is in USDi
    let y1 = Math.max((positionBorrowedUsdi - maxILD) / newClaimableRatio, 0);
    const lowerPrice = (y1 * y1) / newInvariant;

    // Solution 2: Price goes up, IL is in iAsset
    let a = positionBorrowedIasset / newInvariant;
    let b = -newClaimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const upperPrice = (y2 * y2) / newInvariant;

    // Max USDi borrowed position possible before health = 0
    let maxUsdiPosition = Math.max(
      0,
      (100 * newCollateralAmount - ilHealthScoreCoefficient * ILD) /
        poolCoefficient
    );

    return {
      maxCollateralWithdrawable: maxCollateralWithdrawable,
      healthScore: newHealthScore,
      maxUsdiPosition: maxUsdiPosition,
      lowerPrice: lowerPrice,
      upperPrice: upperPrice,
    };
  }

  public async calculateEditCometSinglePoolWithRange(
    cometIndex: number,
    collateralChange: number,
    price: number,
    isLowerPrice: boolean
  ): Promise<{
    maxCollateralWithdrawable: number;
    usdiPosition: number;
    healthScore: number;
    lowerPrice: number;
    upperPrice: number;
  }> {
    const tolerance = 1e-9;
    const maxIter = 100000;
    const comet = await this.getSinglePoolComet(cometIndex);
    const tokenData = await this.getTokenData();
    const position = comet.positions[0];
    const currentUsdiPosition = toScaledNumber(position.borrowedUsdi);
    const currentIassetPosition = toScaledNumber(position.borrowedIasset);
    const pool = tokenData.pools[position.poolIndex];
    const poolUsdi = toScaledNumber(pool.usdiAmount);
    const poolIasset = toScaledNumber(pool.iassetAmount);
    const poolPrice = poolUsdi / poolIasset;
    const ilHealthScoreCoefficient = toScaledNumber(
      tokenData.ilHealthScoreCoefficient
    );
    const poolCoefficient = toScaledNumber(
      pool.assetInfo.healthScoreCoefficient
    );
    const poolLpTokens = toScaledNumber(pool.liquidityTokenSupply);
    const lpTokens = toScaledNumber(position.liquidityTokenValue);
    const claimableRatio = lpTokens / poolLpTokens;

    const currentCollateral = toScaledNumber(comet.totalCollateralAmount);
    let newCollateralAmount = currentCollateral + collateralChange;

    const initData = await this.calculateEditCometSinglePoolWithUsdiBorrowed(
      cometIndex,
      collateralChange,
      0
    );

    const priceRange = (
      usdPosition: number
    ): { lower: number; upper: number } => {
      const usdiBorrowedChange = usdPosition - currentUsdiPosition;
      let positionBorrowedUsdi = currentUsdiPosition;
      let positionBorrowedIasset = currentIassetPosition;
      const iassetBorrowedChange = usdiBorrowedChange / poolPrice;

      let newClaimableRatio = claimableRatio;
      // Calculate total lp tokens
      if (usdiBorrowedChange > 0) {
        newClaimableRatio +=
          usdiBorrowedChange / (usdiBorrowedChange + poolUsdi);
      } else if (usdiBorrowedChange < 0) {
        const claimableUsdi = claimableRatio * poolUsdi;
        const newLpTokens =
          (lpTokens * (positionBorrowedUsdi + usdiBorrowedChange)) /
          claimableUsdi;
        newClaimableRatio =
          newLpTokens / (poolLpTokens - lpTokens + newLpTokens);
      }
      positionBorrowedUsdi += usdiBorrowedChange;
      positionBorrowedIasset += iassetBorrowedChange;

      let newPoolUsdi = poolUsdi + usdiBorrowedChange;
      let newPooliAsset = poolIasset + iassetBorrowedChange;

      const positionLoss = poolCoefficient * positionBorrowedUsdi;

      const maxILD =
        (100 * newCollateralAmount - positionLoss) / ilHealthScoreCoefficient;

      const newInvariant = newPoolUsdi * newPooliAsset;

      // Solution 1: Price goes down, IL is in USDi
      let y1 = Math.max((positionBorrowedUsdi - maxILD) / newClaimableRatio, 0);
      const lowerPrice = (y1 * y1) / newInvariant;

      // Solution 2: Price goes up, IL is in iAsset
      let a = positionBorrowedIasset / newInvariant;
      let b = -newClaimableRatio;
      let c = -maxILD;
      let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      const upperPrice = (y2 * y2) / newInvariant;

      // Max USDi borrowed position possible before health = 0
      a = ilHealthScoreCoefficient + poolCoefficient;
      b = poolCoefficient * newPoolUsdi - 100 * newCollateralAmount;
      c = -100 * newCollateralAmount * newPoolUsdi;

      return { lower: lowerPrice, upper: upperPrice };
    };

    let startSearch = 0;
    let stopSearch = initData.maxUsdiPosition;
    let positionGuess = (startSearch + stopSearch) * 0.5;
    let iter = 0;
    while (iter < maxIter) {
      positionGuess = (startSearch + stopSearch) * 0.5;

      let range = priceRange(positionGuess);

      if (isLowerPrice) {
        let diff = range.lower - price;
        if (Math.abs(diff) < tolerance) {
          break;
        }

        if (diff < 0) {
          // Increase position to increase lower
          startSearch = positionGuess;
        } else {
          stopSearch = positionGuess;
        }
      } else {
        let diff = range.upper - price;
        if (Math.abs(diff) < tolerance) {
          break;
        }

        if (diff < 0) {
          // Reduce position to increase upper
          stopSearch = positionGuess;
        } else {
          startSearch = positionGuess;
        }
      }
      iter += 1;
    }

    if (iter === maxIter) {
      throw new CalculationError("Max iterations reached!");
    }

    const finalData = await this.calculateEditCometSinglePoolWithUsdiBorrowed(
      cometIndex,
      collateralChange,
      positionGuess - currentUsdiPosition
    );
    return {
      maxCollateralWithdrawable: finalData.maxCollateralWithdrawable,
      usdiPosition: positionGuess,
      healthScore: finalData.healthScore,
      lowerPrice: isLowerPrice ? price : finalData.lowerPrice,
      upperPrice: !isLowerPrice ? price : finalData.upperPrice,
    };
  }

  public async calculateCometRecenterSinglePool(cometIndex: number): Promise<{
    healthScore: number;
    usdiCost: number;
    lowerPrice: number;
    upperPrice: number;
  }> {
    const tokenData = await this.getTokenData();
    const comet = await this.getSinglePoolComet(cometIndex);
    const position = comet.positions[0];
    const pool = tokenData.pools[position.poolIndex];

    const ilCoefficient = toScaledNumber(tokenData.ilHealthScoreCoefficient);
    const assetCoefficient = toScaledNumber(
      pool.assetInfo.healthScoreCoefficient
    );

    const borrowedUsdi = toScaledNumber(position.borrowedUsdi);
    const borrowedIasset = toScaledNumber(position.borrowedIasset);
    const lpTokens = toScaledNumber(position.liquidityTokenValue);

    const initPrice = borrowedUsdi / borrowedIasset;
    let poolUsdiAmount = toScaledNumber(pool.usdiAmount);
    let poolIassetAmount = toScaledNumber(pool.iassetAmount);
    let poolPrice = poolUsdiAmount / poolIassetAmount;
    const invariant = poolUsdiAmount * poolIassetAmount;

    const claimableRatio =
      lpTokens / (lpTokens + toScaledNumber(pool.liquidityTokenSupply));

    assert.notEqual(
      initPrice,
      poolPrice,
      "Cannot recenter with same initial and pool prices"
    );
    const iAssetDebt = Math.abs(
      borrowedIasset - claimableRatio * poolIassetAmount
    );
    const usdiDebt = Math.abs(borrowedUsdi - claimableRatio * poolUsdiAmount);
    let usdiCost;
    if (initPrice < poolPrice) {
      // calculate extra usdi comet can claim, iasset debt that comet cannot claim, and usdi amount needed to buy iasset and cover debt
      const requiredUsdi =
        invariant / (poolIassetAmount - iAssetDebt) - poolUsdiAmount;
      usdiCost = requiredUsdi - usdiDebt;

      poolIassetAmount -= iAssetDebt;
      poolUsdiAmount += requiredUsdi;
    } else {
      // calculate extra iAsset comet can claim, usdi debt that comet cannot claim, and amount of usdi gained from trading iasset.
      let extraUsdiFromIasset =
        poolUsdiAmount - invariant / (poolIassetAmount + iAssetDebt);
      usdiCost = usdiDebt - extraUsdiFromIasset;
    }

    const newBorrowedUsdi = claimableRatio * poolUsdiAmount;
    const newBorrowedIasset = claimableRatio * poolIassetAmount;
    const newCollateral = toScaledNumber(comet.totalCollateralAmount);

    const positionLoss = assetCoefficient * newBorrowedUsdi;

    const healthScore = 100 - positionLoss / newCollateral;

    const maxILD = (100 * newCollateral - positionLoss) / ilCoefficient;

    // Solution 1: Price goes down, IL is in USDi
    let y1 = Math.max((newBorrowedUsdi - maxILD) / claimableRatio, 0);

    // Solution 2: Price goes up, IL is in iAsset
    let a = newBorrowedIasset / invariant;
    let b = -claimableRatio;
    let c = -maxILD;
    let y2 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);

    return {
      usdiCost: usdiCost,
      healthScore: healthScore,
      lowerPrice: (y1 * y1) / invariant,
      upperPrice: (y2 * y2) / invariant,
    };
  }

  public async getUSDiAndiAssetAmountsFromLiquidtyTokens(
    cometIndex: number
  ): Promise<{ usdiClaim: number; iAssetClaim: number }> {
    let comet = await this.getSinglePoolComet(cometIndex);
    let tokenData = await this.getTokenData();
    let position = comet.positions[0];
    let pool = tokenData.pools[position.poolIndex];

    let lpTokensClaimed = toScaledNumber(position.liquidityTokenValue);
    let totalLpTokens = toScaledNumber(pool.liquidityTokenSupply);

    let claimableRatio = lpTokensClaimed / totalLpTokens;

    return {
      usdiClaim: claimableRatio * toScaledNumber(pool.usdiAmount),
      iAssetClaim: claimableRatio * toScaledNumber(pool.iassetAmount),
    };
  }

  public async payIldWithCollateral(
    cometPositionIndex: number,
    cometCollateralUsdiIndex: number,
    collateralAmount: BN,
    forManager: boolean = false
  ) {
    const instruction = await this.payIldWithCollateralInstruction(
      cometPositionIndex,
      cometCollateralUsdiIndex,
      collateralAmount,
      forManager
    );
    await this.provider.send(new Transaction().add(instruction));
  }

  public async payIldWithCollateralInstruction(
    cometPositionIndex: number,
    cometCollateralUsdiIndex: number,
    collateralAmount: BN,
    forManager: boolean
  ) {
    const [managerAddress, managerNonce] = this.managerAddress;
    let userAccount = await this.getUserAccount();
    let comet = await this.getComet(forManager);
    let position = comet.positions[cometPositionIndex];
    let tokenData = await this.getTokenData();
    let pool = tokenData.pools[position.poolIndex];
    let usdiCollateralIndex =
      comet.collaterals[cometCollateralUsdiIndex].collateralIndex;
    let usdiCollateral = tokenData.collaterals[usdiCollateralIndex];

    return await this.program.instruction.payIldWithCollateral(
      managerNonce,
      cometPositionIndex,
      cometCollateralUsdiIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: managerAddress,
          tokenData: this.manager!.tokenData,
          comet: forManager ? userAccount.cometManager : userAccount.comet,
          usdiMint: this.manager!.usdiMint,
          iassetMint: pool.assetInfo.iassetMint,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          vault: usdiCollateral.vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }
}

export interface Manager {
  usdiMint: PublicKey;
  liquidatedCometUsdi: PublicKey;
  tokenData: PublicKey;
  admin: PublicKey;
}

export interface User {
  isManager: BN;
  authority: PublicKey;
  singlePoolComets: PublicKey;
  mintPositions: PublicKey;
  liquidityPositions: PublicKey;
  comet: PublicKey;
  cometManager: PublicKey;
}

export interface TokenData {
  manager: PublicKey;
  numPools: BN;
  numCollaterals: BN;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
  chainlinkProgram: PublicKey;
  ilHealthScoreCoefficient: Value;
}

export interface LiquidityPositions {
  owner: PublicKey;
  numPositions: BN;
  liquidityPositions: Array<LiquidityPosition>;
}

export interface LiquidityPosition {
  authority: PublicKey;
  liquidityTokenValue: Value;
  poolIndex: number;
}

export interface MintPositions {
  owner: PublicKey;
  numPositions: BN;
  mintPositions: Array<MintPosition>;
}

export interface MintPosition {
  authority: PublicKey;
  collateralAmount: Value;
  poolIndex: number;
  collateralIndex: number;
  borrowedIasset: Value;
}

export interface LiquidationStatus {
  healthy: object;
  partially: object;
  fully: object;
}

export interface CometLiquidation {
  status: number;
  excessTokenTypeIsUsdi: number;
  excessTokenAmount: Value;
}

export interface Comet {
  isSinglePool: BN;
  owner: PublicKey;
  numPositions: BN;
  numCollaterals: BN;
  totalCollateralAmount: Value;
  positions: Array<CometPosition>;
  collaterals: Array<CometCollateral>;
}

export interface CometPosition {
  authority: PublicKey;
  poolIndex: number;
  borrowedUsdi: Value;
  borrowedIasset: Value;
  liquidityTokenValue: Value;
  cometLiquidation: CometLiquidation;
}

export interface CometCollateral {
  authority: PublicKey;
  collateralAmount: Value;
  collateralIndex: number;
}

export interface SinglePoolComets {
  owner: PublicKey;
  numComets: BN;
  comets: Array<PublicKey>;
}

export interface Value {
  val: BN;
  scale: BN;
}

export interface AssetInfo {
  iassetMint: PublicKey;
  priceFeedAddresses: Array<PublicKey>;
  price: Value;
  twap: Value;
  confidence: Value;
  status: number;
  lastUpdate: number;
  stableCollateralRatio: Value;
  cryptoCollateralRatio: Value;
  healthScoreCoefficient: Value;
}

export interface Pool {
  iassetTokenAccount: PublicKey;
  usdiTokenAccount: PublicKey;
  liquidityTokenMint: PublicKey;
  liquidationIassetTokenAccount: PublicKey;
  cometLiquidityTokenAccount: PublicKey;
  iassetAmount: Value;
  usdiAmount: Value;
  liquidityTokenSupply: Value;
  treasuryTradingFee: Value;
  liquidityTradingFee: Value;
  assetInfo: AssetInfo;
}

export interface Collateral {
  poolIndex: number;
  mint: PublicKey;
  vault: PublicKey;
  vaultUsdiSupply: Value;
  vaultMintSupply: Value;
  vaultCometSupply: Value;
  stable: number;
}
