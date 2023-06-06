import * as anchor from "@coral-xyz/anchor";
import { BN, Program, Provider } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Clone as CloneProgram, IDL } from "./idl/clone";
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
import { getMantissa, toNumber } from "./decimal";
import {
  Clone as CloneInfo,
  TokenData,
  Comet,
  User,
  BorrowPositions,
} from "./interfaces";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
export const DEVNET_TOKEN_SCALE = 8;
export const MAX_PRICE_SIZE = 128;

export const toDevnetScale = (x: number): BN => {
  const scale = new BN(`1${"0".repeat(DEVNET_TOKEN_SCALE)}`);
  const hi = new BN(x).mul(scale);
  const low = new BN((x % 1) * Math.pow(10, DEVNET_TOKEN_SCALE));
  return hi.add(low);
};

export class CloneClient {
  connection: Connection;
  programId: PublicKey;
  program: Program<CloneProgram>;
  clone?: CloneInfo;
  opts?: ConfirmOptions;
  cloneAddress: [PublicKey, number];
  provider: Provider;

  public constructor(
    programId: PublicKey,
    provider: Provider,
    opts?: ConfirmOptions
  ) {
    this.cloneAddress = [PublicKey.default, 0];
    this.connection = provider.connection;
    this.programId = programId;
    this.provider = provider;
    this.opts = opts;
    this.program = new Program<CloneProgram>(IDL, this.programId, provider);
  }
  public async initializeClone(
    ilHealthScoreCutoff: number,
    ilLiquidationRewardPct: number,
    maxHealthLiquidation: number,
    liquidatorFee: number,
    treasuryAddress: PublicKey,
    usdcMint: PublicKey
  ) {
    const managerPubkeyAndBump = await this.getCloneAddress();
    const usdcVault = anchor.web3.Keypair.generate();
    const onusdMint = anchor.web3.Keypair.generate();
    const onusdVault = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeClone(
        toDevnetScale(ilHealthScoreCutoff),
        toDevnetScale(ilLiquidationRewardPct),
        new BN(maxHealthLiquidation),
        new BN(liquidatorFee),
        treasuryAddress
      )
      .accounts({
        admin: this.provider.publicKey!,
        clone: managerPubkeyAndBump[0],
        onusdMint: onusdMint.publicKey,
        onusdVault: onusdVault.publicKey,
        usdcMint: usdcMint,
        usdcVault: usdcVault.publicKey,
        tokenData: tokenData.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .preInstructions([
        await this.program.account.tokenData.createInstruction(tokenData),
      ])
      .signers([onusdMint, onusdVault, usdcVault, tokenData])
      .rpc();

    this.cloneAddress = managerPubkeyAndBump;
    this.clone = (await this.program.account.clone.fetch(
      this.cloneAddress[0]
    )) as CloneInfo;
  }

  public async loadManager() {
    this.cloneAddress = await this.getCloneAddress();
    this.clone = (await this.getCloneAccount()) as CloneInfo;
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
    stable: boolean,
    collateral_mint: PublicKey,
    collateralization_ratio: number = 0,
    poolIndex?: number
  ) {
    const vaultAccount = anchor.web3.Keypair.generate();

    await this.program.methods
      .addCollateral(
        scale,
        stable,
        toDevnetScale(collateralization_ratio),
        poolIndex !== undefined ? poolIndex : 255
      )
      .accounts({
        admin: admin,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        collateralMint: collateral_mint,
        vault: vaultAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
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
    ilHealthScoreCoefficient: number,
    positionHealthScoreCoefficient: number,
    liquidationDiscountRate: number,
    maxOwnershipPct: number,
    underlyingAssetMint: PublicKey
  ) {
    const onusdTokenAccount = anchor.web3.Keypair.generate();
    const onassetMintAccount = anchor.web3.Keypair.generate();
    const onassetTokenAccount = anchor.web3.Keypair.generate();
    const underlyingAssetTokenAccount = anchor.web3.Keypair.generate();
    const liquidityTokenMintAccount = anchor.web3.Keypair.generate();
    const cometLiquidityTokenAccount = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializePool(
        stableCollateralRatio,
        cryptoCollateralRatio,
        liquidityTradingFee,
        treasuryTradingFee,
        toDevnetScale(ilHealthScoreCoefficient),
        toDevnetScale(positionHealthScoreCoefficient),
        new BN(liquidationDiscountRate),
        new BN(maxOwnershipPct)
      )
      .accounts({
        admin: admin,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        onusdMint: this.clone!.onusdMint,
        onusdTokenAccount: onusdTokenAccount.publicKey,
        onassetMint: onassetMintAccount.publicKey,
        onassetTokenAccount: onassetTokenAccount.publicKey,
        underlyingAssetMint: underlyingAssetMint,
        underlyingAssetTokenAccount: underlyingAssetTokenAccount.publicKey,
        liquidityTokenMint: liquidityTokenMintAccount.publicKey,
        cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
        pythOracle: pythOracle,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([
        onusdTokenAccount,
        onassetMintAccount,
        onassetTokenAccount,
        underlyingAssetTokenAccount,
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
        pubkey: tokenData.pools[index].assetInfo.pythAddress,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
      })
      .remainingAccounts(priceFeeds)
      .instruction();
  }

  public async getTokenData() {
    return (await this.program.account.tokenData.fetch(
      this.clone!.tokenData
    )) as TokenData;
  }

  public async getLiquidityPositions(): Promise<
    { liquidityTokens: number; poolIndex: number }[]
  > {
    const tokenData = await this.getTokenData();

    let balancesQueries = await Promise.allSettled(
      tokenData.pools
        .slice(0, tokenData.numPools.toNumber())
        .map(async (pool) => {
          let ata = await getAssociatedTokenAddress(
            pool.liquidityTokenMint,
            this.provider.publicKey!
          );
          let balance = await this.provider.connection.getTokenAccountBalance(
            ata
          );
          return balance.value.uiAmount;
        })
    );

    let positions = [];

    for (let poolIndex = 0; poolIndex < balancesQueries.length; poolIndex++) {
      let result = balancesQueries[poolIndex];
      if (result.status === "fulfilled") {
        if (result.value! > 0) {
          positions.push({
            poolIndex,
            liquidityTokens: result.value!,
          });
        }
      }
    }

    return positions;
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

  public async getCloneAddress() {
    return await PublicKey.findProgramAddress(
      [Buffer.from("clone")],
      this.program.programId
    );
  }

  public async getCloneAccount() {
    return (await this.program.account.clone.fetch(
      this.cloneAddress[0]
    )) as CloneInfo;
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

  public async mintOnUsd(
    amount: number,
    userOnUsdTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const mintOnUsdIx = (await this.mintOnUsdInstruction(
      toDevnetScale(amount),
      userOnUsdTokenAccount,
      userCollateralTokenAccount
    )) as TransactionInstruction;
    await this.provider.sendAndConfirm!(
      new Transaction().add(mintOnUsdIx),
      signers
    );
  }

  public async mintOnUsdInstruction(
    amount: BN,
    userOnUsdTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    return await this.program.methods
      .mintOnusd(amount)
      .accounts({
        user: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        usdcVault: tokenData.collaterals[1].vault,
        onusdMint: this.clone!.onusdMint,
        userOnusdTokenAccount: userOnUsdTokenAccount,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async initializeBorrowPosition(
    onassetAmount: BN,
    collateralAmount: BN,
    userCollateralTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const initializeBorrowPositionIx =
      await this.initializeBorrowPositionInstruction(
        userCollateralTokenAccount,
        userOnAssetTokenAccount,
        onassetAmount,
        collateralAmount,
        poolIndex,
        collateralIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(initializeBorrowPositionIx),
      signers
    );
  }

  public async initializeBorrowPositionsAccountInstruction(
    borrowPositionsAccount: Keypair
  ) {
    let { userPubkey, bump } = await this.getUserAddress();
    let tx = new Transaction();
    tx.add(
      await this.program.account.borrowPositions.createInstruction(
        borrowPositionsAccount
      )
    ).add(
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
        .instruction()
    );
    return tx;
  }

  public async initializeBorrowPositionInstruction(
    userCollateralTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number,
    borrowPositionsAddress?: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let { userPubkey, bump } = await this.getUserAddress();

    return await this.program.methods
      .initializeBorrowPosition(
        poolIndex,
        collateralIndex,
        onassetAmount,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        borrowPositions: borrowPositionsAddress
          ? borrowPositionsAddress
          : userAccount.borrowPositions,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        userOnassetTokenAccount: userOnAssetTokenAccount,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        vault: tokenData.collaterals[mintPosition.collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async payBorrowDebt(
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number,
    signers: Array<Keypair>
  ) {
    const payBorrowDebtIx =
      await this.payBorrowDebtInstruction(
        userOnAssetTokenAccount,
        onassetAmount,
        borrowIndex
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(payBorrowDebtIx),
      signers
    );
  }
  public async payBorrowDebtInstruction(
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ) {
    let mint = (await this.getBorrowPositions()).borrowPositions[borrowIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = await tokenData.pools[mint.poolIndex].assetInfo;
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .payBorrowDebt(borrowIndex, onassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        onassetMint: assetInfo.onassetMint,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async borrowMore(
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number,
    signers: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const borrowMoreIx = await this.borrowMoreInstruction(
      userOnAssetTokenAccount,
      onassetAmount,
      borrowIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(borrowMoreIx),
      signers
    );
  }
  public async borrowMoreInstruction(
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ) {
    let mint = (await this.getBorrowPositions()).borrowPositions[borrowIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = await tokenData.pools[mint.poolIndex].assetInfo;
    let userAccount = await this.getUserAccount();
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .borrowMore(borrowIndex, onassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        borrowPositions: userAccount.borrowPositions,
        onassetMint: assetInfo.onassetMint,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async closeBorrowPosition(
    userOnAssetTokenAccount: PublicKey,
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    signers: Array<Keypair>
  ) {
    let mintPosition = (await this.getBorrowPositions()).borrowPositions[
      borrowIndex
    ];

    const payBorrowDebtIx =
      await this.payBorrowDebtInstruction(
        userOnAssetTokenAccount,
        new BN(getMantissa(mintPosition.borrowedOnasset)),
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
        .add(payBorrowDebtIx)
        .add(updatePricesIx)
        .add(withdrawCollateralFromBorrowIx),
      signers
    );
  }

  public async provideUnconcentratedLiquidity(
    onassetAmount: BN,
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const provideUnconcentratedLiquidityIx =
      await this.provideUnconcentratedLiquidityInstruction(
        userOnUsdTokenAccount,
        userOnAssetTokenAccount,
        userLiquidityTokenAccount,
        onassetAmount,
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
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    onassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let pool = tokenData.pools[poolIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .provideUnconcentratedLiquidity(poolIndex, onassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        userOnusdTokenAccount: userOnUsdTokenAccount,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        userLiquidityTokenAccount: userLiquidityTokenAccount,
        ammOnusdTokenAccount: pool.onusdTokenAccount,
        ammOnassetTokenAccount: pool.onassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawUnconcentratedLiquidity(
    liquidityTokenAmount: BN,
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawUnconcentratedLiquidityIx =
      await this.withdrawUnconcentratedLiquidityInstruction(
        userOnUsdTokenAccount,
        userOnAssetTokenAccount,
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
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        userOnusdTokenAccount: userOnUsdTokenAccount,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        userLiquidityTokenAccount: userLiquidityTokenAccount,
        ammOnusdTokenAccount: pool.onusdTokenAccount,
        ammOnassetTokenAccount: pool.onassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async buyOnAsset(
    onassetAmount: BN,
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    poolIndex: number,
    onusdSpendThreshold: BN,
    treasuryOnAssetTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const buyOnAssetIx = await this.buyOnAssetInstruction(
      userOnUsdTokenAccount,
      userOnAssetTokenAccount,
      onassetAmount,
      poolIndex,
      onusdSpendThreshold,
      treasuryOnAssetTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(buyOnAssetIx),
      signers
    );
  }
  public async buyOnAssetInstruction(
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    poolIndex: number,
    onusdSpendThreshold: BN,
    treasuryOnAssetTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    return await this.program.methods
      .buyOnasset(poolIndex, onassetAmount, onusdSpendThreshold)
      .accounts({
        user: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        userOnusdTokenAccount: userOnUsdTokenAccount,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount: tokenData.pools[poolIndex].onassetTokenAccount,
        treasuryOnassetTokenAccount: treasuryOnAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async sellOnAsset(
    onassetAmount: BN,
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    poolIndex: number,
    onusdReceivedThreshold: BN,
    treasuryOnUsdTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const sellOnAssetIx = await this.sellOnAssetInstruction(
      userOnUsdTokenAccount,
      userOnAssetTokenAccount,
      onassetAmount,
      poolIndex,
      onusdReceivedThreshold,
      treasuryOnUsdTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(sellOnAssetIx),
      signers
    );
  }
  public async sellOnAssetInstruction(
    userOnUsdTokenAccount: PublicKey,
    userOnAssetTokenAccount: PublicKey,
    onassetAmount: BN,
    poolIndex: number,
    onusdReceivedThreshold: BN,
    treasuryOnUsdTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();

    return await this.program.methods
      .sellOnasset(poolIndex, onassetAmount, onusdReceivedThreshold)
      .accounts({
        user: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        userOnusdTokenAccount: userOnUsdTokenAccount,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount: tokenData.pools[poolIndex].onassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        treasuryOnusdTokenAccount: treasuryOnUsdTokenAccount,
      })
      .instruction();
  }

  public async openNewSinglePoolComet(
    userCollateralTokenAccount: PublicKey,
    onusdAmount: BN,
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
        onusdAmount,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
    onusdAmount: BN,
    positionIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const singlePoolComet = (await this.getSinglePoolComets()).positions[
      positionIndex
    ];
    const addLiquidityToSinglePoolCometIx =
      await this.addLiquidityToSinglePoolCometInstruction(
        onusdAmount,
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
    onusdAmount: BN,
    positionIndex: number,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    const { userPubkey, bump } = await this.getUserAddress();
    const userAccountData = (await this.getUserAccount()) as User;

    return await this.program.methods
      .addLiquidityToSinglePoolComet(positionIndex, onusdAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        singlePoolComet: userAccountData.singlePoolComets,
        onusdMint: this.clone!.onusdMint,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount: tokenData.pools[poolIndex].onassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[poolIndex].cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
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
        toDevnetScale(
          toNumber(singlePoolComet.collaterals[cometIndex].collateralAmount)
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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
    onusdAmount: BN,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addLiquidityToCometIx = await this.addLiquidityToCometInstruction(
      onusdAmount,
      poolIndex
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(addLiquidityToCometIx),
      signers
    );
  }
  public async addLiquidityToCometInstruction(
    onusdAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .addLiquidityToComet(poolIndex, onusdAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        onusdMint: this.clone!.onusdMint,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        comet: cometAddress,
        ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount: tokenData.pools[poolIndex].onassetTokenAccount,
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
    userOnAssetTokenAddress: PublicKey,
    userOnUsdTokenAddress: PublicKey,
    isSinglePool: boolean,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityFromCometIx =
      await this.withdrawLiquidityFromCometInstruction(
        liquidityTokenAmount,
        cometPositionIndex,
        userOnAssetTokenAddress,
        userOnUsdTokenAddress,
        isSinglePool
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(withdrawLiquidityFromCometIx),
      signers
    );
  }
  public async withdrawLiquidityFromCometInstruction(
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    userOnAssetTokenAddress: PublicKey,
    userOnUsdTokenAddress: PublicKey,
    isSinglePool: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = isSinglePool
      ? userAccount.singlePoolComets
      : userAccount.comet;
    let comet = isSinglePool
      ? await this.getSinglePoolComets()
      : await this.getComet();
    let position = comet.positions[cometPositionIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .withdrawLiquidityFromComet(cometPositionIndex, liquidityTokenAmount)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        onusdMint: this.clone!.onusdMint,
        onassetMint: tokenData.pools[position.poolIndex].assetInfo.onassetMint,
        comet: cometAddress,
        ammOnusdTokenAccount:
          tokenData.pools[position.poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount:
          tokenData.pools[position.poolIndex].onassetTokenAccount,
        liquidityTokenMint:
          tokenData.pools[position.poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[position.poolIndex].cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        userOnassetTokenAccount: userOnAssetTokenAddress,
        userOnusdTokenAccount: userOnUsdTokenAddress,
      })
      .instruction();
  }

  public async payCometILD(
    cometPositionIndex: number,
    collateralAmount: number,
    payOnUsdDebt: boolean,
    userOnAssetTokenAccount: PublicKey,
    userOnUsdTokenAccount: PublicKey,
    isSinglePool: boolean
  ) {
    const payCometILDIx = await this.payCometILDInstruction(
      cometPositionIndex,
      collateralAmount,
      payOnUsdDebt,
      userOnAssetTokenAccount,
      userOnUsdTokenAccount,
      isSinglePool
    );
    await this.provider.sendAndConfirm!(new Transaction().add(payCometILDIx));
  }
  public async payCometILDInstruction(
    cometPositionIndex: number,
    authorizedAmount: number,
    payOnUsdDebt: boolean,
    userOnAssetTokenAccount: PublicKey,
    userOnUsdTokenAccount: PublicKey,
    isSinglePool: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = isSinglePool
      ? userAccount.singlePoolComets
      : userAccount.comet;
    let comet = isSinglePool
      ? await this.getSinglePoolComets()
      : await this.getComet();
    let cometPosition = comet.positions[cometPositionIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .payImpermanentLossDebt(
        cometPositionIndex,
        new BN(authorizedAmount),
        payOnUsdDebt
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        onusdMint: this.clone!.onusdMint,
        onassetMint:
          tokenData.pools[cometPosition.poolIndex].assetInfo.onassetMint,
        comet: cometAddress,
        ammOnusdTokenAccount:
          tokenData.pools[cometPosition.poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount:
          tokenData.pools[cometPosition.poolIndex].onassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        userOnassetTokenAccount: userOnAssetTokenAccount,
        userOnusdTokenAccount: userOnUsdTokenAccount,
      })
      .instruction();
  }

  // Devnet ONLY!
  public async devnetMintOnUsdInstruction(
    userOnUsdTokenAccount: PublicKey,
    amount: number
  ) {
    return this.program.methods
      .mintOnusdDevnet(new BN(amount))
      .accounts({
        user: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        onusdMint: this.clone!.onusdMint,
        userOnusdTokenAccount: userOnUsdTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async devnetMintOnUsd(
    userOnUsdTokenAccount: PublicKey,
    amount: number
  ) {
    const mintOnUsdTx = await this.devnetMintOnUsdInstruction(
      userOnUsdTokenAccount,
      amount
    );
    await this.provider.sendAndConfirm!(new Transaction().add(mintOnUsdTx));
  }

  public async liquidateBorrowPosition(
    liquidateAccount: PublicKey,
    borrowIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatorOnAssetTokenAccount: PublicKey
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const liquidateMintTx = await this.liquidateBorrowPositionInstruction(
      liquidateAccount,
      borrowIndex,
      liquidatorCollateralTokenAccount,
      liquidatorOnAssetTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(liquidateMintTx)
    );
  }

  public async liquidateBorrowPositionInstruction(
    liquidateAccount: PublicKey,
    borrowIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatorOnAssetTokenAccount: PublicKey
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
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        userAccount: userPubkey,
        user: userAccount.authority,
        onassetMint: pool.assetInfo.onassetMint,
        borrowPositions: userAccount.borrowPositions,
        vault: collateral.vault,
        ammOnusdTokenAccount: pool.onusdTokenAccount,
        ammOnassetTokenAccount: pool.onassetTokenAccount,
        liquidatorCollateralTokenAccount: liquidatorCollateralTokenAccount,
        liquidatorOnassetTokenAccount: liquidatorOnAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async liquidateCometNonstableCollateralInstruction(
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
      .liquidateCometNonstableCollateral(
        amount,
        cometNonStableCollateralIndex,
        cometStableCollateralIndex
      )
      .accounts({
        liquidator: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
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

  public async liquidateStableCollateralInstruction(
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
      .liquidateCometStableCollateral(cometCollateralIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        user: user,
        userAccount: userAccountAddress.userPubKey,
        comet: userAccount.comet,
        onusdMint: this.clone!.onusdMint,
        vault: cometCollateral.vault,
        onusdVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }
}
