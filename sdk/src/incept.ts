import * as anchor from "@project-serum/anchor";
import { BN, Program, Provider } from "@project-serum/anchor";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
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
import {
  BorrowPositionsUninitialized,
  SinglePoolCometUninitialized,
} from "./error";
import { getMantissa } from "./decimal";
import { Incept, TokenData, Comet, User, BorrowPositions } from "./interfaces";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
export const DEVNET_TOKEN_SCALE = 8;
export const MAX_PRICE_SIZE = 128;

export const toDevnetScale = (x: number) => {
  return new BN(x * 10 ** DEVNET_TOKEN_SCALE);
};

export class InceptClient {
  connection: Connection;
  programId: PublicKey;
  program: Program<InceptProgram>;
  incept?: Incept;
  opts?: ConfirmOptions;
  inceptAddress: [PublicKey, number];
  provider: Provider;

  public constructor(
    programId: PublicKey,
    provider: Provider,
    opts?: ConfirmOptions
  ) {
    this.inceptAddress = [PublicKey.default, 0];
    this.connection = provider.connection;
    this.programId = programId;
    this.provider = provider;
    this.opts = opts;
    this.program = new Program<InceptProgram>(IDL, this.programId, provider);
  }
  public async initializeIncept(
    chainlinkProgram: PublicKey,
    ilHealthScoreCoefficient: number,
    ilHealthScoreCutoff: number,
    ilLiquidationRewardPct: number,
    maxHealthLiquidation: number,
    liquidatorFee: number,
    collateralFullLiquidationThreshold: number,
    treasuryAddress: PublicKey
  ) {
    const managerPubkeyAndBump = await this.getInceptAddress();
    const usdiMint = anchor.web3.Keypair.generate();
    const usdiVault = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeIncept(
        toDevnetScale(ilHealthScoreCoefficient),
        toDevnetScale(ilHealthScoreCutoff),
        toDevnetScale(ilLiquidationRewardPct),
        new BN(maxHealthLiquidation),
        new BN(liquidatorFee),
        new BN(collateralFullLiquidationThreshold),
        treasuryAddress
      )
      .accounts({
        admin: this.provider.publicKey!,
        incept: managerPubkeyAndBump[0],
        usdiMint: usdiMint.publicKey,
        usdiVault: usdiVault.publicKey,
        tokenData: tokenData.publicKey,
        rent: RENT_PUBKEY,
        chainlinkProgram: chainlinkProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .preInstructions([
        await this.program.account.tokenData.createInstruction(tokenData),
      ])
      .signers([usdiMint, usdiVault, tokenData])
      .rpc();

    this.inceptAddress = managerPubkeyAndBump;
    this.incept = (await this.program.account.incept.fetch(
      this.inceptAddress[0]
    )) as Incept;
  }

  public async loadManager() {
    this.inceptAddress = await this.getInceptAddress();
    this.incept = (await this.getInceptAccount()) as Incept;
  }

  public async initializeUser(user?: PublicKey) {
    const tx = await this.initializeUserInstruction(user);
    await this.program.provider.sendAndConfirm!(new Transaction().add(tx));
  }

  public async initializeUserInstruction(user?: PublicKey) {
    const { userPubkey, bump } = await this.getUserAddress(user);
    return await this.program.methods
      .initializeUser(user ? user : this.provider.publicKey!)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction();
  }

  public async addCollateral(
    admin: PublicKey,
    scale: number,
    stable: number,
    collateral_mint: PublicKey,
    collateralization_ratio: number = 0,
    pythOracle?: PublicKey,
    chainlinkOracle?: PublicKey
  ) {
    const vaultAccount = anchor.web3.Keypair.generate();

    let remainingAccounts =
      pythOracle && chainlinkOracle
        ? [
            {
              pubkey: pythOracle,
              isWritable: false,
              isSigner: false,
            },
            {
              pubkey: chainlinkOracle,
              isWritable: false,
              isSigner: false,
            },
          ]
        : [];

    await this.program.methods
      .addCollateral(scale, stable, toDevnetScale(collateralization_ratio))
      .accounts({
        admin: admin,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        collateralMint: collateral_mint,
        vault: vaultAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .signers([vaultAccount])
      .rpc();
  }

  public async initializePool(
    admin: PublicKey,
    stableCollateralRatio: number,
    cryptoCollateralRatio: number,
    liquidityTradingFee: number,
    treasuryTradingFee: number,
    pythOracle: PublicKey,
    chainlinkOracle: PublicKey,
    healthScoreCoefficient: number,
    liquidationDiscountRate: number,
    maxOwnershipPct: number
  ) {
    const usdiTokenAccount = anchor.web3.Keypair.generate();
    const iassetMintAccount = anchor.web3.Keypair.generate();
    const iassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidationIassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidityTokenMintAccount = anchor.web3.Keypair.generate();
    const cometLiquidityTokenAccount = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializePool(
        stableCollateralRatio,
        cryptoCollateralRatio,
        liquidityTradingFee,
        treasuryTradingFee,
        toDevnetScale(healthScoreCoefficient),
        new BN(liquidationDiscountRate),
        new BN(maxOwnershipPct)
      )
      .accounts({
        admin: admin,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        usdiTokenAccount: usdiTokenAccount.publicKey,
        iassetMint: iassetMintAccount.publicKey,
        iassetTokenAccount: iassetTokenAccount.publicKey,
        liquidationIassetTokenAccount: liquidationIassetTokenAccount.publicKey,
        liquidityTokenMint: liquidityTokenMintAccount.publicKey,
        cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
        pythOracle: pythOracle,
        chainlinkOracle: chainlinkOracle,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([
        usdiTokenAccount,
        iassetMintAccount,
        iassetTokenAccount,
        liquidationIassetTokenAccount,
        liquidityTokenMintAccount,
        cometLiquidityTokenAccount,
      ])
      .rpc();
  }

  public async updatePrices(poolIndices?: number[], signers?: Array<Keypair>) {
    let txn = new Transaction();
    // const additionalComputeBudgetInstruction =
    //   ComputeBudgetProgram.requestUnits({
    //     units: 400000,
    //     additionalFee: 0,
    //   });
    //txn.add(additionalComputeBudgetInstruction);
    let updatePricesIx = await this.updatePricesInstruction(poolIndices);
    txn.add(updatePricesIx);

    await this.provider.sendAndConfirm!(txn, signers);
  }

  public async updatePricesInstruction(poolIndices?: number[]) {
    const tokenData = await this.getTokenData();
    let arr = [];
    for (let i = 0; i < tokenData.numPools.toNumber(); i++) {
      arr.push(i);
    }
    let indices = poolIndices ? poolIndices : arr;

    let priceFeeds: Array<{
      pubkey: PublicKey;
      isWritable: boolean;
      isSigner: boolean;
    }> = [];

    indices.forEach((index) => {
      priceFeeds.push({
        pubkey: tokenData.pools[index].assetInfo.priceFeedAddresses[0],
        isWritable: false,
        isSigner: false,
      });
    });

    let zero_padding = MAX_PRICE_SIZE - indices.length;
    for (let i = 0; i < zero_padding; i++) {
      indices.push(0);
    }

    return await this.program.methods
      .updatePrices({ indices: indices })
      .accounts({
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
      })
      .remainingAccounts(priceFeeds)
      .instruction();
  }

  public async getTokenData() {
    return (await this.program.account.tokenData.fetch(
      this.incept!.tokenData
    )) as TokenData;
  }

  public async getLiquidityPositions() {
    const tokenData = await this.getTokenData();

    let balancesQueries = await Promise.allSettled(
      tokenData.pools.map(async (pool) => {
        let ata = await getAssociatedTokenAddress(
          pool.assetInfo.iassetMint,
          this.provider.publicKey!
        );
        let balance = await this.provider.connection.getTokenAccountBalance(
          ata
        );
        return balance.value.uiAmount;
      })
    );

    return balancesQueries.map((result) =>
      result.status === "rejected" ? 0 : result.value
    );
  }

  public async getBorrowPositions() {
    const userAccountData = (await this.getUserAccount()) as User;

    if (
      userAccountData.borrowPositions.toString() ===
      PublicKey.default.toString()
    ) {
      throw new BorrowPositionsUninitialized();
    }

    return (await this.program.account.borrowPositions.fetch(
      userAccountData.borrowPositions
    )) as BorrowPositions;
  }

  public async getSinglePoolComets(address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    if (userAccountData.singlePoolComets.equals(PublicKey.default)) {
      throw new SinglePoolCometUninitialized();
    }
    return (await this.program.account.comet.fetch(
      userAccountData.singlePoolComets
    )) as Comet;
  }

  public async getComet(address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    return (await this.program.account.comet.fetch(
      userAccountData.comet
    )) as Comet;
  }

  public async getInceptAddress() {
    return await PublicKey.findProgramAddress(
      [Buffer.from("incept")],
      this.program.programId
    );
  }

  public async getInceptAccount() {
    return (await this.program.account.incept.fetch(
      this.inceptAddress[0]
    )) as Incept;
  }

  public async getUserAddress(address?: PublicKey) {
    if (!address) {
      address = this.provider.publicKey!;
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
    amount: number,
    userUsdiTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const mintUsdiIx = (await this.mintUsdiInstruction(
      toDevnetScale(amount),
      userUsdiTokenAccount,
      userCollateralTokenAccount,
      collateralIndex
    )) as TransactionInstruction;
    await this.provider.sendAndConfirm!(
      new Transaction().add(mintUsdiIx),
      signers
    );
  }

  public async mintUsdiInstruction(
    amount: BN,
    userUsdiTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    return await this.program.methods
      .mintUsdi(new BN(amount))
      .accounts({
        user: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        vault: tokenData.collaterals[collateralIndex].vault,
        usdiMint: this.incept!.usdiMint,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async initializeBorrowPosition(
    iassetAmount: BN,
    collateralAmount: BN,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const initializeBorrowPositionIx =
      await this.initializeBorrowPositionInstruction(
        userCollateralTokenAccount,
        userIassetTokenAccount,
        iassetAmount,
        collateralAmount,
        poolIndex,
        collateralIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(initializeBorrowPositionIx),
      signers
    );
  }

  public async initializeBorrowPositionInstruction(
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let { userPubkey, bump } = await this.getUserAddress();

    if (userAccount.borrowPositions.equals(PublicKey.default)) {
      const borrowPositionsAccount = anchor.web3.Keypair.generate();
      await this.program.methods
        .initializeBorrowPositions()
        .accounts({
          user: this.provider.publicKey!,
          userAccount: userPubkey,
          borrowPositions: borrowPositionsAccount.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        })
        .preInstructions([
          await this.program.account.borrowPositions.createInstruction(
            borrowPositionsAccount
          ),
        ])
        .signers([borrowPositionsAccount])
        .rpc();
    }
    userAccount = await this.getUserAccount();

    return await this.program.methods
      .initializeBorrowPosition(
        poolIndex,
        collateralIndex,
        iassetAmount,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        userIassetTokenAccount: userIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async addCollateralToBorrow(
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    signers?: Array<Keypair>
  ) {
    const addCollateralToBorrowIx = await this.addCollateralToBorrowInstruction(
      borrowIndex,
      userCollateralTokenAccount,
      collateralAmount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(addCollateralToBorrowIx),
      signers
    );
  }

  public async addCollateralToBorrowInstruction(
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();
    const mintPosition = (await this.getBorrowPositions()).borrowPositions[
      borrowIndex
    ];

    return await this.program.methods
      .addCollateralToBorrow(borrowIndex, collateralAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        vault: tokenData.collaterals[mintPosition.collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawCollateralFromBorrow(
    userCollateralTokenAccount: PublicKey,
    borrowIndex: number,
    collateralAmount: BN,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromBorrowIx =
      await this.withdrawCollateralFromBorrowInstruction(
        this.provider.publicKey!,
        borrowIndex,
        userCollateralTokenAccount,
        collateralAmount
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromBorrowIx),
      signers
    );
  }

  public async withdrawCollateralFromBorrowInstruction(
    user: PublicKey,
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();
    const mintPosition = (await this.getBorrowPositions()).borrowPositions[
      borrowIndex
    ];

    return await this.program.methods
      .withdrawCollateralFromBorrow(borrowIndex, collateralAmount)
      .accounts({
        user: user,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        vault: tokenData.collaterals[mintPosition.collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async subtractIassetFromBorrow(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    borrowIndex: number,
    signers: Array<Keypair>
  ) {
    const subtractIassetFromBorrowIx =
      await this.subtractIassetFromBorrowInstruction(
        userIassetTokenAccount,
        iassetAmount,
        borrowIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(subtractIassetFromBorrowIx),
      signers
    );
  }
  public async subtractIassetFromBorrowInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    borrowIndex: number
  ) {
    let mint = (await this.getBorrowPositions()).borrowPositions[borrowIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = await tokenData.pools[mint.poolIndex].assetInfo;
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .subtractIassetFromBorrow(borrowIndex, iassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        iassetMint: assetInfo.iassetMint,
        userIassetTokenAccount: userIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async addIassetToBorrow(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    borrowIndex: number,
    signers: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addIassetToBorrowIx = await this.addIassetToBorrowInstruction(
      userIassetTokenAccount,
      iassetAmount,
      borrowIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(addIassetToBorrowIx),
      signers
    );
  }
  public async addIassetToBorrowInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    borrowIndex: number
  ) {
    let mint = (await this.getBorrowPositions()).borrowPositions[borrowIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = await tokenData.pools[mint.poolIndex].assetInfo;
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .addIassetToBorrow(borrowIndex, iassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        iassetMint: assetInfo.iassetMint,
        userIassetTokenAccount: userIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async closeBorrowPosition(
    userIassetTokenAccount: PublicKey,
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    signers: Array<Keypair>
  ) {
    let mintPosition = (await this.getBorrowPositions()).borrowPositions[
      borrowIndex
    ];

    const subtractIassetFromBorrowIx =
      await this.subtractIassetFromBorrowInstruction(
        userIassetTokenAccount,
        new BN(getMantissa(mintPosition.borrowedIasset)),
        borrowIndex
      );

    const withdrawCollateralFromBorrowIx =
      await this.withdrawCollateralFromBorrowInstruction(
        this.provider.publicKey!,
        borrowIndex,
        userCollateralTokenAccount,
        new BN(getMantissa(mintPosition.collateralAmount))
      );

    const updatePricesIx = await this.updatePricesInstruction();

    await this.provider.sendAndConfirm!(
      new Transaction()
        .add(subtractIassetFromBorrowIx)
        .add(updatePricesIx)
        .add(withdrawCollateralFromBorrowIx),
      signers
    );
  }

  public async provideUnconcentratedLiquidity(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const provideUnconcentratedLiquidityIx =
      await this.provideUnconcentratedLiquidityInstruction(
        userUsdiTokenAccount,
        userIassetTokenAccount,
        userLiquidityTokenAccount,
        iassetAmount,
        poolIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction()
        .add(await this.updatePricesInstruction())
        .add(provideUnconcentratedLiquidityIx),
      signers
    );
  }
  public async provideUnconcentratedLiquidityInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let pool = tokenData.pools[poolIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .provideUnconcentratedLiquidity(poolIndex, iassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userIassetTokenAccount: userIassetTokenAccount,
        userLiquidityTokenAccount: userLiquidityTokenAccount,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawUnconcentratedLiquidity(
    liquidityTokenAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawUnconcentratedLiquidityIx =
      await this.withdrawUnconcentratedLiquidityInstruction(
        userUsdiTokenAccount,
        userIassetTokenAccount,
        userLiquidityTokenAccount,
        liquidityTokenAmount,
        poolIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(withdrawUnconcentratedLiquidityIx),
      signers
    );
  }
  public async withdrawUnconcentratedLiquidityInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();

    let pool = tokenData.pools[poolIndex];

    return await this.program.methods
      .withdrawUnconcentratedLiquidity(poolIndex, liquidityTokenAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userIassetTokenAccount: userIassetTokenAccount,
        userLiquidityTokenAccount: userLiquidityTokenAccount,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async buyIasset(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    usdiSpendThreshold: BN,
    treasuryIassetTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const buyIassetIx = await this.buyIassetInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      usdiSpendThreshold,
      treasuryIassetTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(buyIassetIx),
      signers
    );
  }
  public async buyIassetInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    usdiSpendThreshold: BN,
    treasuryIassetTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    return await this.program.methods
      .buyIasset(poolIndex, iassetAmount, usdiSpendThreshold)
      .accounts({
        user: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userIassetTokenAccount: userIassetTokenAccount,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        treasuryIassetTokenAccount: treasuryIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async sellIasset(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    usdiReceivedThreshold: BN,
    treasuryUsdiTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const sellIassetIx = await this.sellIassetInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      usdiReceivedThreshold,
      treasuryUsdiTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(sellIassetIx),
      signers
    );
  }
  public async sellIassetInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    usdiReceivedThreshold: BN,
    treasuryUsdiTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();

    return await this.program.methods
      .sellIasset(poolIndex, iassetAmount, usdiReceivedThreshold)
      .accounts({
        user: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userIassetTokenAccount: userIassetTokenAccount,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        treasuryUsdiTokenAccount: treasuryUsdiTokenAccount,
      })
      .instruction();
  }

  public async openNewSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    usdiAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const singlePoolComets = await this.getSinglePoolComets();
    const newIndex = singlePoolComets.numPositions.toNumber();
    const updatePricesIx = await this.updatePricesInstruction();

    const initializeSinglePoolCometInstruction =
      await this.initializeSinglePoolCometInstruction(
        poolIndex,
        collateralIndex
      );
    const addCollateralToSinglePoolCometIx =
      await this.addCollateralToSinglePoolCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        collateralIndex,
        newIndex
      );
    const addLiquidityToSinglePoolCometIx =
      await this.addLiquidityToSinglePoolCometInstruction(
        usdiAmount,
        newIndex,
        poolIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction()
        .add(updatePricesIx)
        .add(initializeSinglePoolCometInstruction)
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
    let singlePoolCometsAccount = userAccount.singlePoolComets;
    let { userPubkey, bump } = await this.getUserAddress();

    if (userAccount.singlePoolComets.equals(PublicKey.default)) {
      const singlePoolCometsAccountKeypair = anchor.web3.Keypair.generate();
      singlePoolCometsAccount = singlePoolCometsAccountKeypair.publicKey;

      await this.program.methods
        .initializeComet(true)
        .accounts({
          user: this.provider.publicKey!,
          userAccount: userPubkey,
          comet: singlePoolCometsAccount,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        })
        .preInstructions([
          await this.program.account.comet.createInstruction(
            singlePoolCometsAccountKeypair
          ),
        ])
        .signers([singlePoolCometsAccountKeypair])
        .rpc();
    }
    userAccount = await this.getUserAccount();

    await this.program.methods
      .initializeSinglePoolComet(poolIndex, collateralIndex)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        singlePoolComets: userAccount.singlePoolComets,
      })
      // .preInstructions([
      //   await this.program.account.comet.createInstruction(
      //     singlePoolCometAccount
      //   ),
      // ])
      .rpc();
  }

  public async initializeSinglePoolCometInstruction(
    poolIndex: number,
    collateralIndex: number
  ) {
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .initializeSinglePoolComet(poolIndex, collateralIndex)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        singlePoolComets: userAccount.singlePoolComets,
      })
      // .preInstructions([
      //   await this.program.account.comet.createInstruction(
      //     singlePoolCometAccount
      //   ),
      // ])
      .instruction();
  }

  public async addCollateralToSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    positionIndex: number,
    signers?: Array<Keypair>
  ) {
    let singlePoolComets = await this.getSinglePoolComets();
    const addCollateralToCometIx =
      await this.addCollateralToSinglePoolCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        singlePoolComets.collaterals[positionIndex].collateralIndex,
        positionIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(addCollateralToCometIx),
      signers
    );
  }
  public async addCollateralToSinglePoolCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    positionIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .addCollateralToSinglePoolComet(positionIndex, collateralAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        singlePoolComet: userAccount.singlePoolComets,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawCollateralFromSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromCometIx =
      await this.withdrawCollateralFromSinglePoolCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        cometIndex
      );
    await this.provider.sendAndConfirm!(
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
    const userAccount = await this.getUserAccount();
    let tokenData = await this.getTokenData();
    let singlePoolComet = await this.getSinglePoolComets();

    return await this.program.methods
      .withdrawCollateralFromSinglePoolComet(cometIndex, collateralAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        comet: userAccount.singlePoolComets,
        vault:
          tokenData.collaterals[
            singlePoolComet.collaterals[cometIndex].collateralIndex
          ].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async addLiquidityToSinglePoolComet(
    usdiAmount: BN,
    positionIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const singlePoolComet = (await this.getSinglePoolComets()).positions[
      positionIndex
    ];
    const addLiquidityToSinglePoolCometIx =
      await this.addLiquidityToSinglePoolCometInstruction(
        usdiAmount,
        positionIndex,
        singlePoolComet.poolIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction()
        .add(updatePricesIx)
        .add(addLiquidityToSinglePoolCometIx),
      signers
    );
  }
  public async addLiquidityToSinglePoolCometInstruction(
    usdiAmount: BN,
    positionIndex: number,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    const { userPubkey, bump } = await this.getUserAddress();
    const userAccountData = (await this.getUserAccount()) as User;

    return await this.program.methods
      .addLiquidityToSinglePoolComet(positionIndex, usdiAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        singlePoolComet: userAccountData.singlePoolComets,
        usdiMint: this.incept!.usdiMint,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[poolIndex].cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawLiquidityFromSinglePoolComet(
    liquidityTokenAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityFromSinglePoolCometIx =
      await this.withdrawLiquidityFromSinglePoolCometInstruction(
        liquidityTokenAmount,
        cometIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(withdrawLiquidityFromSinglePoolCometIx),
      signers
    );
  }
  public async withdrawLiquidityFromSinglePoolCometInstruction(
    liquidityTokenAmount: BN,
    positionIndex: number
  ) {
    let tokenData = await this.getTokenData();
    const { userPubkey, bump } = await this.getUserAddress();
    const userAccount = await this.getUserAccount();
    let singlePoolComet = await this.getSinglePoolComets();
    let poolIndex = singlePoolComet.positions[positionIndex].poolIndex;

    return await this.program.methods
      .withdrawLiquidityFromSinglePoolComet(liquidityTokenAmount, positionIndex)
      .accounts({
        user: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        userAccount: userPubkey,
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        singlePoolComet: userAccount.singlePoolComets,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[poolIndex].cometLiquidityTokenAccount,
        vault:
          tokenData.collaterals[
            singlePoolComet.collaterals[positionIndex].collateralIndex
          ].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async recenterSinglePoolComet(
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const recenterSingleCometIx = await this.recenterSingleCometInstruction(
      cometIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(recenterSingleCometIx),
      signers
    );
  }

  public async recenterSingleCometInstruction(positionIndex: number) {
    let tokenData = await this.getTokenData();
    const userAccount = await this.getUserAccount();
    const singlePoolComet = await this.getSinglePoolComets();
    const poolIndex = singlePoolComet.positions[positionIndex].poolIndex;
    const { userPubkey, bump } = await this.getUserAddress();

    return await this.program.methods
      .recenterComet(positionIndex, positionIndex)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        comet: userAccount.singlePoolComets,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        vault:
          tokenData.collaterals[
            singlePoolComet.collaterals[positionIndex].collateralIndex
          ].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async paySinglePoolCometILD(
    cometIndex: number,
    collateralAmount: number,
    signers?: Array<Keypair>
  ) {
    const paySinglePoolCometILDIx = await this.paySinglePoolCometILDInstruction(
      cometIndex,
      collateralAmount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(paySinglePoolCometILDIx),
      signers
    );
  }
  public async paySinglePoolCometILDInstruction(
    cometIndex: number,
    collateralAmount: number
  ) {
    let tokenData = await this.getTokenData();
    const userAccount = await this.getUserAccount();
    let comet = await this.getSinglePoolComets();
    let position = comet.positions[cometIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .payImpermanentLossDebt(0, 0, new BN(collateralAmount))
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        iassetMint: tokenData.pools[position.poolIndex].assetInfo.iassetMint,
        comet: userAccount.singlePoolComets,
        ammUsdiTokenAccount:
          tokenData.pools[position.poolIndex].usdiTokenAccount,
        ammIassetTokenAccount:
          tokenData.pools[position.poolIndex].iassetTokenAccount,
        vault:
          tokenData.collaterals[comet.collaterals[cometIndex].collateralIndex]
            .vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawLiquidityAndPaySinglePoolCometILD(
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    let singlePoolComet = await this.getSinglePoolComets();
    if (Number(singlePoolComet.numPositions) == 0) {
      return;
    }
    if (
      getMantissa(singlePoolComet.positions[cometIndex].liquidityTokenValue) !==
      0
    ) {
      const withdrawLiquidityFromSinglePoolCometIx =
        await this.withdrawLiquidityFromSinglePoolCometInstruction(
          new BN(
            getMantissa(
              singlePoolComet.positions[cometIndex].liquidityTokenValue
            )
          ),
          cometIndex
        );
      const paySinglePoolCometILDIx =
        await this.paySinglePoolCometILDInstruction(
          cometIndex,
          getMantissa(singlePoolComet.collaterals[cometIndex].collateralAmount)
        );
      await this.provider.sendAndConfirm!(
        new Transaction()
          .add(withdrawLiquidityFromSinglePoolCometIx)
          .add(paySinglePoolCometILDIx),
        signers
      );
    } else {
      const paySinglePoolCometILDIx =
        await this.paySinglePoolCometILDInstruction(
          cometIndex,
          getMantissa(singlePoolComet.collaterals[cometIndex].collateralAmount)
        );
      await this.provider.sendAndConfirm!(
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
    await this.provider.sendAndConfirm!(
      new Transaction().add(closeSinglePoolCometIx),
      signers
    );
  }
  public async closeSinglePoolCometInstruction(cometIndex: number) {
    const { userPubkey, bump } = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return await this.program.methods
      .closeSinglePoolComet(cometIndex)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        singlePoolComet: userAccount.singlePoolComets,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawCollateralAndCloseSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    let singlePoolComet = await this.getSinglePoolComets();
    if (
      getMantissa(singlePoolComet.positions[cometIndex].liquidityTokenValue) !=
      0
    ) {
      return;
    }
    const withdrawCollateralFromSinglePoolCometIx =
      await this.withdrawCollateralFromSinglePoolCometInstruction(
        userCollateralTokenAccount,
        new BN(
          getMantissa(singlePoolComet.collaterals[cometIndex].collateralAmount)
        ),
        cometIndex
      );
    const closeSinglePoolCometIx = await this.closeSinglePoolCometInstruction(
      cometIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction()
        .add(await this.updatePricesInstruction())
        .add(withdrawCollateralFromSinglePoolCometIx)
        .add(closeSinglePoolCometIx),
      signers
    );
  }

  public async addCollateralToComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const addCollateralToCometIx = await this.addCollateralToCometInstruction(
      userCollateralTokenAccount,
      collateralAmount,
      collateralIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(addCollateralToCometIx),
      signers
    );
  }

  public async initializeComet(user = this.provider.publicKey!) {
    let { userPubkey, bump } = await this.getUserAddress(user);

    const cometAccount = anchor.web3.Keypair.generate();

    await this.provider.sendAndConfirm!(
      await this.initializeCometInstruction(cometAccount, false, user),
      [cometAccount]
    );
  }

  // public async initializeSinglePoolComet(
  //   user = this.provider.publicKey!
  // ) {
  //   let { userPubkey, bump } = await this.getUserAddress(user);

  //   const cometAccount = anchor.web3.Keypair.generate();

  //   await this.provider.sendAndConfirm!(
  //     await this.initializeCometInstruction(cometAccount, true, user),
  //     [cometAccount]
  //   );
  // }

  public async initializeCometInstruction(
    cometAccount: Keypair,
    isSinglePool: boolean,
    user?: PublicKey
  ) {
    let { userPubkey, bump } = await this.getUserAddress(user);
    let tx = new Transaction()
      .add(await this.program.account.comet.createInstruction(cometAccount))
      .add(
        await this.program.methods
          .initializeComet(isSinglePool)
          .accounts({
            user: user ? user : this.provider.publicKey!,
            userAccount: userPubkey,
            comet: cometAccount.publicKey,
            rent: RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SYSTEM_PROGRAM_ID,
          })
          .instruction()
      );
    return tx;
  }

  public async addCollateralToCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .addCollateralToComet(collateralIndex, collateralAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        comet: cometAddress,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawCollateralFromComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometCollateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromCometIx =
      await this.withdrawCollateralFromCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        cometCollateralIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromCometIx),
      signers
    );
  }
  public async withdrawCollateralFromCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometCollateralIndex: number
  ) {
    const { userPubkey, bump } = await this.getUserAddress();
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let comet = await this.getComet();
    let cometAddress = userAccount.comet;

    return await this.program.methods
      .withdrawCollateralFromComet(cometCollateralIndex, collateralAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        comet: cometAddress,
        vault:
          tokenData.collaterals[
            comet.collaterals[cometCollateralIndex].collateralIndex
          ].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async addLiquidityToComet(
    usdiAmount: BN,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addLiquidityToCometIx = await this.addLiquidityToCometInstruction(
      usdiAmount,
      poolIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(addLiquidityToCometIx),
      signers
    );
  }
  public async addLiquidityToCometInstruction(
    usdiAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .addLiquidityToComet(poolIndex, usdiAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        comet: cometAddress,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[poolIndex].cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawLiquidityFromComet(
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityFromCometIx =
      await this.withdrawLiquidityFromCometInstruction(
        liquidityTokenAmount,
        cometPositionIndex,
        collateralIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(withdrawLiquidityFromCometIx),
      signers
    );
  }
  public async withdrawLiquidityFromCometInstruction(
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let comet = await this.getComet();
    let position = comet.positions[cometPositionIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .withdrawLiquidityFromComet(
        cometPositionIndex,
        liquidityTokenAmount,
        collateralIndex
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
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
        vault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async recenterComet(
    cometPositionIndex: number,
    cometCollateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const recenterCometIx = await this.recenterCometInstruction(
      cometPositionIndex,
      cometCollateralIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(recenterCometIx),
      signers
    );
  }
  public async recenterCometInstruction(
    cometPositionIndex: number,
    cometCollateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let comet = await this.getComet();
    let cometPosition = comet.positions[cometPositionIndex];
    let cometCollateral = comet.collaterals[cometCollateralIndex];
    let [managerAddress, managerNonce] = await this.getInceptAddress();
    let { userPubkey, bump } = await this.getUserAddress();

    return await this.program.methods
      .recenterComet(cometPositionIndex, cometCollateralIndex)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        incept: managerAddress,
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        iassetMint:
          tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
        comet: cometAddress,
        ammUsdiTokenAccount:
          tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
        ammIassetTokenAccount:
          tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
        liquidityTokenMint:
          tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
        vault: tokenData.collaterals[cometCollateral.collateralIndex].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async payCometILD(
    cometPositionIndex: number,
    cometCollateralIndex: number,
    collateralAmount: number,
    signers?: Array<Keypair>
  ) {
    const payCometILDIx = await this.payCometILDInstruction(
      cometPositionIndex,
      cometCollateralIndex,
      collateralAmount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(payCometILDIx),
      signers
    );
  }
  public async payCometILDInstruction(
    cometPositionIndex: number,
    cometCollateralIndex: number,
    collateralAmount: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let comet = await this.getComet();
    let cometPosition = comet.positions[cometPositionIndex];
    let cometCollateral = comet.collaterals[cometCollateralIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .payImpermanentLossDebt(
        cometPositionIndex,
        cometCollateralIndex,
        new BN(collateralAmount)
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        iassetMint:
          tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
        comet: cometAddress,
        ammUsdiTokenAccount:
          tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
        ammIassetTokenAccount:
          tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
        vault: tokenData.collaterals[cometCollateral.collateralIndex].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  // Hackathon ONLY!
  public async hackathonMintUsdiInstruction(
    userUsdiTokenAccount: PublicKey,
    amount: number
  ) {
    return this.program.methods
      .mintUsdiHackathon(new BN(amount))
      .accounts({
        user: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        usdiMint: this.incept!.usdiMint,
        userUsdiTokenAccount: userUsdiTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async hackathonMintUsdi(
    userUsdiTokenAccount: PublicKey,
    amount: number
  ) {
    const mintUsdiTx = await this.hackathonMintUsdiInstruction(
      userUsdiTokenAccount,
      amount
    );
    await this.provider.sendAndConfirm!(new Transaction().add(mintUsdiTx));
  }

  public async liquidateBorrowPosition(
    liquidateAccount: PublicKey,
    borrowIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatoriAssetTokenAccount: PublicKey
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const liquidateMintTx = await this.liquidateBorrowPositionInstruction(
      liquidateAccount,
      borrowIndex,
      liquidatorCollateralTokenAccount,
      liquidatoriAssetTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(liquidateMintTx)
    );
  }

  public async liquidateBorrowPositionInstruction(
    liquidateAccount: PublicKey,
    borrowIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatoriAssetTokenAccount: PublicKey
  ) {
    const { userPubkey, bump } = await this.getUserAddress(liquidateAccount);
    const userAccount = await this.getUserAccount(userPubkey);
    const tokenData = await this.getTokenData();

    const mintPosition = (await this.getBorrowPositions()).borrowPositions[
      borrowIndex
    ];
    const pool = tokenData.pools[mintPosition.poolIndex];
    const collateral = tokenData.collaterals[mintPosition.collateralIndex];

    return this.program.methods
      .liquidateBorrowPosition(borrowIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        userAccount: userPubkey,
        user: userAccount.authority,
        iassetMint: pool.assetInfo.iassetMint,
        borrowPositions: userAccount.borrowPositions,
        vault: collateral.vault,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidatorCollateralTokenAccount: liquidatorCollateralTokenAccount,
        liquidatorIassetTokenAccount: liquidatoriAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async updateILHealthScoreCoefficient(coefficient: number) {
    const [pubKey, bump] = await this.getInceptAddress();

    await this.program.methods
      .updateIlHealthScoreCoefficient(toDevnetScale(coefficient))
      .accounts({
        admin: this.provider.publicKey!,
        incept: pubKey,
        tokenData: this.incept!.tokenData,
      })
      .rpc();
  }

  public async updatePoolHealthScoreCoefficient(
    coefficient: number,
    poolIndex: number
  ) {
    const [pubKey, bump] = await this.getInceptAddress();
    await this.program.methods
      .updatePoolHealthScoreCoefficient(poolIndex, toDevnetScale(coefficient))
      .accounts({
        admin: this.provider.publicKey!,
        incept: pubKey,
        tokenData: this.incept!.tokenData,
      })
      .rpc();
  }

  public async liquidateSinglePoolComet(
    positionIndex: number,
    user: PublicKey,
    liquidatorUsdiCollateralTokenAccount: PublicKey,
    userAddress: { userPubkey: PublicKey; bump: number },
    userAccount: User,
    userComet: Comet,
    tokenData: TokenData
  ) {
    let tx = new Transaction()
      .add(await this.updatePricesInstruction())
      .add(
        await this.liquidateSinglePoolCometInstruction(
          user,
          userAddress,
          userAccount,
          userComet,
          tokenData,
          positionIndex,
          liquidatorUsdiCollateralTokenAccount
        )
      );
    await this.provider.sendAndConfirm!(tx);
  }

  public async liquidateSinglePoolCometInstruction(
    user: PublicKey,
    userAddress: { userPubkey: PublicKey; bump: number },
    userAccount: User,
    userComet: Comet,
    tokenData: TokenData,
    positionIndex: number,
    liquidatorUsdiCollateralTokenAccount: PublicKey
  ) {
    let pool =
      tokenData.pools[Number(userComet.positions[positionIndex].poolIndex)];
    let collateral =
      tokenData.collaterals[
        userComet.collaterals[positionIndex].collateralIndex
      ];
    return await this.program.methods
      .liquidateSinglePoolComet(positionIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        user: user,
        userAccount: userAddress.userPubkey,
        comet: userAccount.singlePoolComets,
        usdiMint: this.incept!.usdiMint,
        iassetMint: pool.assetInfo.iassetMint,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        liquidatorUsdiTokenAccount: liquidatorUsdiCollateralTokenAccount,
        usdiVault: collateral.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async swapCometNonstableCollateralInstruction(
    user: PublicKey,
    userAccountAddress: { userPubKey: PublicKey; bump: number },
    userAccount: User,
    userComet: Comet,
    tokenData: TokenData,
    amount: BN,
    cometNonStableCollateralIndex: number,
    cometStableCollateralIndex: number,
    liquidatorStableCollateralAccount: PublicKey,
    liquidatorNonstableCollateralAccount: PublicKey
  ): Promise<TransactionInstruction> {
    const nonstableCollateral =
      tokenData.collaterals[
        userComet.collaterals[cometNonStableCollateralIndex].collateralIndex
      ];
    const stableCollateral =
      tokenData.collaterals[
        userComet.collaterals[cometStableCollateralIndex].collateralIndex
      ];

    return await this.program.methods
      .swapNonstableCollateral(
        amount,
        cometNonStableCollateralIndex,
        cometStableCollateralIndex
      )
      .accounts({
        liquidator: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        user: user,
        userAccount: userAccountAddress.userPubKey,
        comet: userAccount.comet,
        stableCollateralMint: stableCollateral.mint,
        stableCollateralVault: stableCollateral.vault,
        liquidatorStableCollateralTokenAccount:
          liquidatorStableCollateralAccount,
        nonstableCollateralMint: nonstableCollateral.mint,
        nonstableCollateralVault: nonstableCollateral.vault,
        liquidatorNonstableCollateralTokenAccount:
          liquidatorNonstableCollateralAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async swapStableCollateralIntoUsdiInstruction(
    user: PublicKey,
    userAccountAddress: { userPubKey: PublicKey; bump: number },
    userAccount: User,
    userComet: Comet,
    tokenData: TokenData,
    cometCollateralIndex: number
  ): Promise<TransactionInstruction> {
    const cometCollateral =
      tokenData.collaterals[
        userComet.collaterals[cometCollateralIndex].collateralIndex
      ];

    return await this.program.methods
      .swapStableCollateralIntoUsdi(cometCollateralIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        user: user,
        userAccount: userAccountAddress.userPubKey,
        comet: userAccount.comet,
        usdiMint: this.incept!.usdiMint,
        vault: cometCollateral.vault,
        usdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async liquidateCometInstruction(
    user: PublicKey,
    userAccountAddress: { userPubKey: PublicKey; bump: number },
    userAccount: User,
    userComet: Comet,
    tokenData: TokenData,
    cometPositionIndex: number,
    liquidatorUsdiTokenAccount: PublicKey
  ): Promise<TransactionInstruction> {
    let pool =
      tokenData.pools[userComet.positions[cometPositionIndex].poolIndex];
    return await this.program.methods
      .liquidateComet(cometPositionIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        incept: this.inceptAddress[0],
        tokenData: this.incept!.tokenData,
        user: user,
        userAccount: userAccountAddress.userPubKey,
        comet: userAccount.comet,
        usdiMint: this.incept!.usdiMint,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        liquidatorUsdiTokenAccount: liquidatorUsdiTokenAccount,
        usdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }
}
