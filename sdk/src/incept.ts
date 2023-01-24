import * as anchor from "@project-serum/anchor";
import { BN, Program, Provider } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
  MintPositionsUninitialized,
  SinglePoolCometUninitialized,
  LiquidityPositionsUninitialized,
} from "./error";
import { getMantissa } from "./decimal";
import {
  Manager,
  TokenData,
  Comet,
  User,
  LiquidityPositions,
  MintPositions,
} from "./interfaces";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
export const DEVNET_TOKEN_SCALE = 8;
export const MAX_PRICE_SIZE = 128;

export const toDevnetScale = (x: number) => {
  return new BN(x * 10 ** DEVNET_TOKEN_SCALE);
};

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
    ilLiquidationRewardPct: number,
    maxHealthLiquidation: number,
    liquidatorFee: number,
    collateralFullLiquidationThreshold: number,
    treasuryAddress: PublicKey
  ) {
    const managerPubkeyAndBump = await this.getManagerAddress();
    const usdiMint = anchor.web3.Keypair.generate();
    const usdiVault = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeManager(
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
        manager: managerPubkeyAndBump[0],
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

    this.managerAddress = managerPubkeyAndBump;
    this.manager = (await this.program.account.manager.fetch(
      this.managerAddress[0]
    )) as Manager;
  }

  public async loadManager() {
    this.managerAddress = await this.getManagerAddress();
    this.manager = (await this.getManagerAccount()) as Manager;
  }

  public async initializeUser(user?: PublicKey) {
    const tx = await this.initializeUserInstruction(user);
    await this.program.provider.sendAndConfirm!(new Transaction().add(tx));
  }

  public async initializeUserInstruction(user?: PublicKey) {
    const { userPubkey, bump } = await this.getUserAddress(user);
    return await this.program.methods
      .initializeUser(bump)
      .accounts({
        user: user ? user : this.provider.publicKey!,
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
      .addCollateral(
        this.managerAddress[1],
        scale,
        stable,
        toDevnetScale(collateralization_ratio)
      )
      .accounts({
        admin: admin,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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
    liquidationDiscountRate: number
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
        new BN(liquidationDiscountRate)
      )
      .accounts({
        admin: admin,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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
      .updatePrices(this.managerAddress[1], { indices: indices })
      .accounts({
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
      })
      .remainingAccounts(priceFeeds)
      .instruction();
  }

  public async getTokenData() {
    return (await this.program.account.tokenData.fetch(
      this.manager!.tokenData
    )) as TokenData;
  }

  public async getLiquidityPositions() {
    const userAccountData = (await this.getUserAccount()) as User;
    if (
      userAccountData.liquidityPositions.equals(anchor.web3.PublicKey.default)
    ) {
      throw new LiquidityPositionsUninitialized();
    }
    return (await this.program.account.liquidityPositions.fetch(
      userAccountData.liquidityPositions
    )) as LiquidityPositions;
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

  public async getSinglePoolComets(address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    if (userAccountData.singlePoolComets.equals(PublicKey.default)) {
      throw new SinglePoolCometUninitialized();
    }
    return (await this.program.account.comet.fetch(
      userAccountData.singlePoolComets
    )) as Comet;
  }

  public async getComet(forManager?: boolean, address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    return (await this.program.account.comet.fetch(
      forManager ? userAccountData.cometManager.comet : userAccountData.comet
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
      .mintUsdi(this.managerAddress[1], new BN(amount))
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        vault: tokenData.collaterals[collateralIndex].vault,
        usdiMint: this.manager!.usdiMint,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
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
    const updatePricesIx = await this.updatePricesInstruction();
    const initializeMintPositionIx =
      await this.initializeMintPositionInstruction(
        userCollateralTokenAccount,
        userIassetTokenAccount,
        iassetAmount,
        collateralAmount,
        poolIndex,
        collateralIndex
      );
    await this.provider.sendAndConfirm!(
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
      await this.program.methods
        .initializeMintPositions(bump)
        .accounts({
          user: this.provider.publicKey!,
          userAccount: userPubkey,
          mintPositions: mintPositionsAccount.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        })
        .preInstructions([
          await this.program.account.mintPositions.createInstruction(
            mintPositionsAccount
          ),
        ])
        .signers([mintPositionsAccount])
        .rpc();
    }
    userAccount = await this.getUserAccount();

    return await this.program.methods
      .initializeMintPosition(
        this.managerAddress[1],
        poolIndex,
        collateralIndex,
        iassetAmount,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        mintPositions: userAccount.mintPositions,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        userIassetTokenAccount: userIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async addCollateralToMint(
    mintIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    signers?: Array<Keypair>
  ) {
    const addCollateralToMintIx = await this.addCollateralToMintInstruction(
      mintIndex,
      userCollateralTokenAccount,
      collateralAmount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(addCollateralToMintIx),
      signers
    );
  }

  public async addCollateralToMintInstruction(
    mintIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    const mintPosition = (await this.getMintPositions()).mintPositions[
      mintIndex
    ];

    return await this.program.methods
      .addCollateralToMint(this.managerAddress[1], mintIndex, collateralAmount)
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        mintPositions: userAccount.mintPositions,
        vault: tokenData.collaterals[mintPosition.collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async withdrawCollateralFromMint(
    userCollateralTokenAccount: PublicKey,
    mintIndex: number,
    collateralAmount: BN,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromMintIx =
      await this.withdrawCollateralFromMintInstruction(
        this.provider.publicKey!,
        mintIndex,
        userCollateralTokenAccount,
        collateralAmount
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromMintIx),
      signers
    );
  }

  public async withdrawCollateralFromMintInstruction(
    user: PublicKey,
    mintIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    const mintPosition = (await this.getMintPositions()).mintPositions[
      mintIndex
    ];

    return await this.program.methods
      .withdrawCollateralFromMint(
        this.managerAddress[1],
        mintIndex,
        collateralAmount
      )
      .accounts({
        user: user,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        mintPositions: userAccount.mintPositions,
        vault: tokenData.collaterals[mintPosition.collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
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
    await this.provider.sendAndConfirm!(
      new Transaction().add(payBackiAssetToMintIx),
      signers
    );
  }
  public async payBackiAssetToMintInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    mintIndex: number
  ) {
    let mint = (await this.getMintPositions()).mintPositions[mintIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = await tokenData.pools[mint.poolIndex].assetInfo;
    let userAccount = await this.getUserAccount();

    return await this.program.methods
      .payBackMint(this.managerAddress[1], mintIndex, iassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        mintPositions: userAccount.mintPositions,
        iassetMint: assetInfo.iassetMint,
        userIassetTokenAccount: userIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
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
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(addiAssetToMintIx),
      signers
    );
  }
  public async addiAssetToMintInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    mintIndex: number
  ) {
    let mint = (await this.getMintPositions()).mintPositions[mintIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = await tokenData.pools[mint.poolIndex].assetInfo;
    let userAccount = await this.getUserAccount();

    return await this.program.methods
      .addIassetToMint(this.managerAddress[1], mintIndex, iassetAmount)
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        mintPositions: userAccount.mintPositions,
        iassetMint: assetInfo.iassetMint,
        userIassetTokenAccount: userIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async closeMintPosition(
    userIassetTokenAccount: PublicKey,
    mintIndex: number,
    userCollateralTokenAccount: PublicKey,
    signers: Array<Keypair>
  ) {
    let mintPosition = (await this.getMintPositions()).mintPositions[mintIndex];

    const payBackiAssetToMintIx = await this.payBackiAssetToMintInstruction(
      userIassetTokenAccount,
      new BN(getMantissa(mintPosition.borrowedIasset)),
      mintIndex
    );

    const withdrawCollateralFromMintIx =
      await this.withdrawCollateralFromMintInstruction(
        this.provider.publicKey!,
        mintIndex,
        userCollateralTokenAccount,
        new BN(getMantissa(mintPosition.collateralAmount))
      );

    const updatePricesIx = await this.updatePricesInstruction();

    await this.provider.sendAndConfirm!(
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
    let userAccount = await this.getUserAccount();
    let newSigners = signers === undefined ? [] : signers;
    let tx = new Transaction();
    let liquidityPositionAddress = userAccount.liquidityPositions;
    if (liquidityPositionAddress.equals(PublicKey.default)) {
      const liquidityPositionsAccount = anchor.web3.Keypair.generate();
      liquidityPositionAddress = liquidityPositionsAccount.publicKey;
      tx.add(
        await this.program.account.liquidityPositions.createInstruction(
          liquidityPositionsAccount
        )
      );
      tx.add(
        await this.initializeLiquidityPositionsInstruction(
          liquidityPositionsAccount
        )
      );
      newSigners.push(liquidityPositionsAccount);
    }

    tx.add(
      await this.initializeLiquidityPositionInstruction(
        userUsdiTokenAccount,
        userIassetTokenAccount,
        userLiquidityTokenAccount,
        iassetAmount,
        poolIndex,
        liquidityPositionAddress
      )
    );
    await this.provider.sendAndConfirm!(
      tx,
      newSigners
      //signers
    );
  }
  public async initializeLiquidityPositionInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    liquidityPositionsAddress?: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let pool = await tokenData.pools[poolIndex];

    return await this.program.methods
      .initializeLiquidityPosition(
        this.managerAddress[1],
        poolIndex,
        iassetAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        liquidityPositions:
          liquidityPositionsAddress !== undefined
            ? liquidityPositionsAddress
            : userAccount.liquidityPositions,
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

  public async initializeLiquidityPositionsInstruction(
    liquidityPositionsAccount: Keypair
  ) {
    let { userPubkey, bump } = await this.getUserAddress();
    return await this.program.instruction.initializeLiquidityPositions(bump, {
      accounts: {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        liquidityPositions: liquidityPositionsAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
    });
  }

  public async provideLiquidity(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    liquidityPosition: number,
    signers?: Array<Keypair>
  ) {
    const provideLiquidityIx = await this.provideLiquidityInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      userLiquidityTokenAccount,
      iassetAmount,
      liquidityPosition
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(provideLiquidityIx),
      signers
    );
  }
  public async provideLiquidityInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    liquidityPosition: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let userLiquidityPosition = (await this.getLiquidityPositions())
      .liquidityPositions[liquidityPosition];
    let pool = tokenData.pools[userLiquidityPosition.poolIndex];

    return await this.program.methods
      .provideLiquidity(
        this.managerAddress[1],
        userLiquidityPosition.poolIndex,
        iassetAmount
      )
      .accounts({
        user: this.provider.publicKey!,
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
      })
      .instruction();
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
    await this.provider.sendAndConfirm!(
      new Transaction().add(withdrawLiquidityIx),
      signers
    );
  }
  public async withdrawLiquidityInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    liquidityTokenAmount: BN,
    liquidityPositionIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let liquidityPosition = (await this.getLiquidityPositions())
      .liquidityPositions[liquidityPositionIndex];

    let pool = tokenData.pools[liquidityPosition.poolIndex];

    return await this.program.methods
      .withdrawLiquidity(
        this.managerAddress[1],
        liquidityPositionIndex,
        liquidityTokenAmount
      )
      .accounts({
        user: this.provider.publicKey!,
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
      })
      .instruction();
  }

  public async buySynth(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    usdiSpendThreshold: BN,
    treasuryIassetTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const buySynthIx = await this.buySynthInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      usdiSpendThreshold,
      treasuryIassetTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(buySynthIx),
      signers
    );
  }
  public async buySynthInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    usdiSpendThreshold: BN,
    treasuryIassetTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    return await this.program.methods
      .buySynth(
        this.managerAddress[1],
        poolIndex,
        iassetAmount,
        usdiSpendThreshold
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        userUsdiTokenAccount: userUsdiTokenAccount,
        userIassetTokenAccount: userIassetTokenAccount,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        treasuryIassetTokenAccount: treasuryIassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async sellSynth(
    iassetAmount: BN,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    usdiReceivedThreshold: BN,
    treasuryUsdiTokenAccount: PublicKey,
    signers?: Array<Keypair>
  ) {
    const sellSynthIx = await this.sellSynthInstruction(
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      usdiReceivedThreshold,
      treasuryUsdiTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(sellSynthIx),
      signers
    );
  }
  public async sellSynthInstruction(
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    usdiReceivedThreshold: BN,
    treasuryUsdiTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();

    return await this.program.methods
      .sellSynth(
        this.managerAddress[1],
        poolIndex,
        iassetAmount,
        usdiReceivedThreshold
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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

    if (userAccount.singlePoolComets.equals(PublicKey.default)) {
      let { userPubkey, bump } = await this.getUserAddress();
      const singlePoolCometsAccountKeypair = anchor.web3.Keypair.generate();
      singlePoolCometsAccount = singlePoolCometsAccountKeypair.publicKey;

      await this.program.methods
        .initializeComet(bump, true)
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
      .initializeSinglePoolComet(
        this.managerAddress[1],
        poolIndex,
        collateralIndex
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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

    return await this.program.methods
      .initializeSinglePoolComet(
        this.managerAddress[1],
        poolIndex,
        collateralIndex
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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

    return await this.program.methods
      .addCollateralToSinglePoolComet(
        this.managerAddress[1],
        positionIndex,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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
      .withdrawCollateralFromSinglePoolComet(
        this.managerAddress[1],
        bump,
        cometIndex,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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
      .addLiquidityToSinglePoolComet(
        bump,
        this.managerAddress[1],
        positionIndex,
        usdiAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        singlePoolComet: userAccountData.singlePoolComets,
        usdiMint: this.manager!.usdiMint,
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
      .withdrawLiquidityFromSinglePoolComet(
        bump,
        this.managerAddress[1],
        liquidityTokenAmount,
        positionIndex
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        userAccount: userPubkey,
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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
      .recenterComet(bump, this.managerAddress[1], positionIndex, positionIndex)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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

    return await this.program.methods
      .payImpermanentLossDebt(
        this.managerAddress[1],
        0,
        0,
        new BN(collateralAmount)
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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
      .closeSinglePoolComet(bump, cometIndex)
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

  public async initializeCometManager(user = this.provider.publicKey!) {
    const { userPubkey, bump } = await this.getUserAddress(user);

    const cometManagerAccount = anchor.web3.Keypair.generate();
    const memberShipTokenMintAccount = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeCometManager(this.managerAddress[1], bump)
      .accounts({
        user: this.provider.publicKey!,
        admin: this.provider.publicKey!,
        manager: this.managerAddress[0],
        userAccount: userPubkey,
        cometManager: cometManagerAccount.publicKey,
        membershipTokenMint: memberShipTokenMintAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .preInstructions([
        await this.program.account.comet.createInstruction(cometManagerAccount),
      ])
      .signers([cometManagerAccount, memberShipTokenMintAccount])
      .rpc();
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
          .initializeComet(bump, isSinglePool)
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
    collateralIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager.comet
      : userAccount.comet;

    return await this.program.methods
      .addCollateralToComet(
        this.managerAddress[1],
        collateralIndex,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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
    await this.provider.sendAndConfirm!(
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
      ? userAccount.cometManager.comet
      : userAccount.comet;

    return await this.program.methods
      .withdrawCollateralFromComet(
        this.managerAddress[1],
        bump,
        cometCollateralIndex,
        collateralAmount
      )
      .accounts({
        user: this.provider.publicKey!,
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
      })
      .instruction();
  }

  public async addLiquidityToComet(
    usdiAmount: BN,
    poolIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addLiquidityToCometIx = await this.addLiquidityToCometInstruction(
      usdiAmount,
      poolIndex,
      forManager
    );
    await this.provider.sendAndConfirm!(
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
      ? userAccount.cometManager.comet
      : userAccount.comet;

    return await this.program.methods
      .addLiquidityToComet(this.managerAddress[1], poolIndex, usdiAmount)
      .accounts({
        user: this.provider.publicKey!,
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
      })
      .instruction();
  }

  public async withdrawLiquidityFromComet(
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    collateralIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityFromCometIx =
      await this.withdrawLiquidityFromCometInstruction(
        liquidityTokenAmount,
        cometPositionIndex,
        collateralIndex,
        forManager
      );
    await this.provider.sendAndConfirm!(
      new Transaction().add(withdrawLiquidityFromCometIx),
      signers
    );
  }
  public async withdrawLiquidityFromCometInstruction(
    liquidityTokenAmount: BN,
    cometPositionIndex: number,
    collateralIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager.comet
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let position = comet.positions[cometPositionIndex];

    return await this.program.methods
      .withdrawLiquidityFromComet(
        this.managerAddress[1],
        cometPositionIndex,
        liquidityTokenAmount,
        collateralIndex
      )
      .accounts({
        user: this.provider.publicKey!,
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
        vault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async recenterComet(
    cometPositionIndex: number,
    cometCollateralIndex: number,
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const recenterCometIx = await this.recenterCometInstruction(
      cometPositionIndex,
      cometCollateralIndex,
      forManager
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(recenterCometIx),
      signers
    );
  }
  public async recenterCometInstruction(
    cometPositionIndex: number,
    cometCollateralIndex: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager.comet
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let cometPosition = comet.positions[cometPositionIndex];
    let cometCollateral = comet.collaterals[cometCollateralIndex];
    let [managerAddress, managerNonce] = await this.getManagerAddress();
    let { userPubkey, bump } = await this.getUserAddress();

    return await this.program.methods
      .recenterComet(
        bump,
        managerNonce,
        cometPositionIndex,
        cometCollateralIndex
      )
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        manager: managerAddress,
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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
    forManager: boolean,
    signers?: Array<Keypair>
  ) {
    const payCometILDIx = await this.payCometILDInstruction(
      cometPositionIndex,
      cometCollateralIndex,
      collateralAmount,
      forManager
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(payCometILDIx),
      signers
    );
  }
  public async payCometILDInstruction(
    cometPositionIndex: number,
    cometCollateralIndex: number,
    collateralAmount: number,
    forManager: boolean
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = forManager
      ? userAccount.cometManager.comet
      : userAccount.comet;
    let comet = await this.getComet(forManager);
    let cometPosition = comet.positions[cometPositionIndex];
    let cometCollateral = comet.collaterals[cometCollateralIndex];

    return await this.program.methods
      .payImpermanentLossDebt(
        this.managerAddress[1],
        cometPositionIndex,
        cometCollateralIndex,
        new BN(collateralAmount)
      )
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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
      .mintUsdiHackathon(this.managerAddress[1], new BN(amount))
      .accounts({
        user: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        usdiMint: this.manager!.usdiMint,
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

  public async liquidateMintPosition(
    liquidateAccount: PublicKey,
    liquidateAccountBump: number,
    mintIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatoriAssetTokenAccount: PublicKey
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const liquidateMintTx = await this.liquidateMintPositionInstruction(
      liquidateAccount,
      liquidateAccountBump,
      mintIndex,
      liquidatorCollateralTokenAccount,
      liquidatoriAssetTokenAccount
    );
    await this.provider.sendAndConfirm!(
      new Transaction().add(updatePricesIx).add(liquidateMintTx)
    );
  }

  public async liquidateMintPositionInstruction(
    liquidateAccount: PublicKey,
    liquidateAccountBump: number,
    mintIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatoriAssetTokenAccount: PublicKey
  ) {
    const userAccount = await this.getUserAccount(liquidateAccount);
    const tokenData = await this.getTokenData();

    const mintPosition = (await this.getMintPositions()).mintPositions[
      mintIndex
    ];
    const pool = tokenData.pools[mintPosition.poolIndex];
    const collateral = tokenData.collaterals[mintPosition.collateralIndex];

    return this.program.methods
      .liquidateMintPosition(
        this.managerAddress[1],
        liquidateAccountBump,
        mintIndex
      )
      .accounts({
        liquidator: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        userAccount: liquidateAccount,
        user: liquidateAccount,
        iassetMint: pool.assetInfo.iassetMint,
        mintPositions: userAccount.mintPositions,
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
    const [pubKey, bump] = await this.getManagerAddress();

    await this.program.methods
      .updateIlHealthScoreCoefficient(bump, toDevnetScale(coefficient))
      .accounts({
        admin: this.provider.publicKey!,
        manager: pubKey,
        tokenData: this.manager!.tokenData,
      })
      .rpc();
  }

  public async updatePoolHealthScoreCoefficient(
    coefficient: number,
    poolIndex: number
  ) {
    const [pubKey, bump] = await this.getManagerAddress();
    await this.program.methods
      .updatePoolHealthScoreCoefficient(
        bump,
        poolIndex,
        toDevnetScale(coefficient)
      )
      .accounts({
        admin: this.provider.publicKey!,
        manager: pubKey,
        tokenData: this.manager!.tokenData,
      })
      .rpc();
  }

  public async liquidateSinglePoolComet(
    positionIndex: number,
    user: PublicKey,
    liquidatorUsdiCollateralTokenAccount: PublicKey,
    userAddress: { userPubkey: PublicKey; bump: number },
    userAccount: User,
    tokenData: TokenData,
    userComet: Comet
  ) {
    let tx = new Transaction()
      .add(await this.updatePricesInstruction())
      .add(
        await this.liquidateSinglePoolCometInstruction(
          positionIndex,
          user,
          liquidatorUsdiCollateralTokenAccount,
          userAddress,
          userAccount,
          tokenData,
          userComet
        )
      );
    await this.provider.sendAndConfirm!(tx);
  }

  public async liquidateSinglePoolCometInstruction(
    positionIndex: number,
    user: PublicKey,
    liquidatorUsdiCollateralTokenAccount: PublicKey,
    userAddress: { userPubkey: PublicKey; bump: number },
    userAccount: User,
    tokenData: TokenData,
    userComet: Comet
  ) {
    let pool =
      tokenData.pools[Number(userComet.positions[positionIndex].poolIndex)];
    let collateral =
      tokenData.collaterals[
        userComet.collaterals[positionIndex].collateralIndex
      ];
    return await this.program.methods
      .liquidateComet(userAddress.bump, positionIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        user: user,
        userAccount: userAddress.userPubkey,
        comet: userAccount.comet,
        usdiMint: this.manager!.usdiMint,
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
        userAccountAddress.bump,
        amount,
        cometNonStableCollateralIndex,
        cometStableCollateralIndex
      )
      .accounts({
        liquidator: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
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
      .swapStableCollateralIntoUsdi(
        userAccountAddress.bump,
        cometCollateralIndex
      )
      .accounts({
        liquidator: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        user: user,
        userAccount: userAccountAddress.userPubKey,
        comet: userAccount.comet,
        usdiMint: this.manager!.usdiMint,
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
      .liquidateComet(userAccountAddress.bump, cometPositionIndex)
      .accounts({
        liquidator: this.provider.publicKey!,
        manager: this.managerAddress[0],
        tokenData: this.manager!.tokenData,
        user: user,
        userAccount: userAccountAddress.userPubKey,
        comet: userAccount.comet,
        usdiMint: this.manager!.usdiMint,
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
