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
import { BorrowPositionsUninitialized } from "./error";
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

export const toScale = (x: number, scale: number): BN => {
  const multiplier = new BN(`1${"0".repeat(scale)}`);
  const hi = new BN(x).mul(multiplier);
  const low = new BN((x % 1) * Math.pow(10, scale));
  return hi.add(low);
};

export const toDevnetScale = (x: number): BN => {
  return toScale(x, DEVNET_TOKEN_SCALE);
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
  }

  public async loadClone() {
    this.cloneAddress = await this.getCloneAddress();
    this.clone = (await this.getCloneAccount()) as CloneInfo;
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

    let signers = [
      onusdTokenAccount,
      onassetMintAccount,
      onassetTokenAccount,
      underlyingAssetTokenAccount,
      liquidityTokenMintAccount,
      cometLiquidityTokenAccount,
    ];

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
      .signers(signers)
      .rpc();
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

  public async getComet(address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    return (await this.program.account.comet.fetch(
      userAccountData.comet
    )) as Comet;
  }

  public async getCloneAddress() {
    return PublicKey.findProgramAddressSync(
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

  public async mintOnusdInstruction(
    amount: BN,
    userOnusdTokenAccount: PublicKey,
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
        userOnusdTokenAccount: userOnusdTokenAccount,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
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
    userOnassetTokenAccount: PublicKey,
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
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
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

  public async withdrawCollateralFromBorrowInstruction(
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

  public async payBorrowDebtInstruction(
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ) {
    let mint = (await this.getBorrowPositions()).borrowPositions[borrowIndex];
    let tokenData = await this.getTokenData();
    let assetInfo = tokenData.pools[mint.poolIndex].assetInfo;
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
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async borrowMoreInstruction(
    userOnassetTokenAccount: PublicKey,
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
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async swapInstruction(
    poolIndex: number,
    quantity: BN,
    quantityIsInput: boolean,
    quantityIsOnusd: boolean,
    threshold: BN,
    onassetMint: PublicKey,
    userOnusdTokenAddress: PublicKey,
    userOnassetTokenAddress: PublicKey,
    treasuryOnusdTokenAddress: PublicKey,
    treasuryOnassetTokenAddress: PublicKey
  ) {
    return await this.program.methods
      .swap(poolIndex, quantity, quantityIsInput, quantityIsOnusd, threshold)
      .accounts({
        user: this.provider.publicKey!,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        userOnassetTokenAccount: userOnassetTokenAddress,
        userOnusdTokenAccount: userOnusdTokenAddress,
        treasuryOnusdTokenAccount: treasuryOnusdTokenAddress,
        treasuryOnassetTokenAccount: treasuryOnassetTokenAddress,
        onusdMint: this.clone!.onusdMint,
        onassetMint: onassetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async initializeCometInstruction(
    cometAccount: Keypair,
    user?: PublicKey
  ) {
    let { userPubkey, bump } = await this.getUserAddress(user);
    let tx = new Transaction()
      .add(await this.program.account.comet.createInstruction(cometAccount))
      .add(
        await this.program.methods
          .initializeComet()
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

  public async addLiquidityToCometInstruction(
    onusdAmount: BN,
    poolIndex: number
  ) {
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
        comet: cometAddress,
      })
      .instruction();
  }

  public async withdrawLiquidityFromCometInstruction(
    onusdWithdrawal: BN,
    cometPositionIndex: number
  ) {
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .withdrawLiquidityFromComet(cometPositionIndex, onusdWithdrawal)
      .accounts({
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress[0],
        tokenData: this.clone!.tokenData,
        comet: cometAddress,
      })
      .instruction();
  }

  public async payCometILDInstruction(
    cometPositionIndex: number,
    authorizedAmount: BN,
    payOnusdDebt: boolean,
    userOnassetTokenAccount: PublicKey,
    userOnusdTokenAccount: PublicKey
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();
    let cometAddress = userAccount.comet;
    let comet = await this.getComet();
    let cometPosition = comet.positions[cometPositionIndex];
    let userAddress = await this.getUserAddress();

    return await this.program.methods
      .payImpermanentLossDebt(
        cometPositionIndex,
        authorizedAmount,
        payOnusdDebt
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
        tokenProgram: TOKEN_PROGRAM_ID,
        userOnassetTokenAccount: userOnassetTokenAccount,
        userOnusdTokenAccount: userOnusdTokenAccount,
      })
      .instruction();
  }

  public async liquidateBorrowPositionInstruction(
    liquidateAccount: PublicKey,
    borrowIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatorOnassetTokenAccount: PublicKey,
    tokenData: TokenData
  ) {
    const { userPubkey, bump } = await this.getUserAddress(liquidateAccount);
    const userAccount = await this.getUserAccount(userPubkey);

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
        liquidatorCollateralTokenAccount: liquidatorCollateralTokenAccount,
        liquidatorOnassetTokenAccount: liquidatorOnassetTokenAccount,
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

  public async claimLpRewardsInstruction(
    userOnusdTokenAccount: PublicKey,
    onassetTokenAccountInfo: PublicKey,
    cometPositionIndex: number
  ): Promise<TransactionInstruction> {
    const { userPubkey } = await this.getUserAddress();
    const userAccount = await this.getUserAccount();
    const userComet = await this.getComet();
    const tokenData = await this.getTokenData();
    const poolIndex = Number(userComet.positions[cometPositionIndex].poolIndex)
    const pool = tokenData.pools[poolIndex]

    return await this.program.methods
    .collectLpRewards(cometPositionIndex)
    .accounts({
      user: this.provider.publicKey!,
      userAccount: userPubkey,
      clone: this.cloneAddress[0],
      tokenData: this.clone!.tokenData,
      comet: userAccount.comet,
      onusdMint: this.clone!.onusdMint,
      onassetMint: pool.assetInfo.onassetMint,
      userOnusdTokenAccount: userOnusdTokenAccount,
      userOnassetTokenAccount: onassetTokenAccountInfo,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  }
}
