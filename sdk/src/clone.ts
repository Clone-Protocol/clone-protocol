import * as anchor from "@coral-xyz/anchor";
import * as beet from "@metaplex-foundation/beet";
import { BN, Provider } from "@coral-xyz/anchor";
import {
  PublicKey,
  ConfirmOptions,
  TransactionInstruction,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getAccount,
} from "@solana/spl-token";
import {
  Clone,
  User,
  createInitializeUserInstruction,
  createUpdatePricesInstruction,
  createAddCollateralToBorrowInstruction,
  createWithdrawCollateralFromBorrowInstruction,
  createPayBorrowDebtInstruction,
  createBorrowMoreInstruction,
  createSwapInstruction,
  createAddCollateralToCometInstruction,
  createWithdrawCollateralFromCometInstruction,
  createAddLiquidityToCometInstruction,
  createWithdrawLiquidityFromCometInstruction,
  createPayImpermanentLossDebtInstruction,
  createLiquidateBorrowPositionInstruction,
  createCollectLpRewardsInstruction,
  createInitializeBorrowPositionInstruction,
  createInitializeCloneInstruction,
  UpdatePoolParametersInstructionArgs,
  createUpdatePoolParametersInstruction,
  UpdateCloneParametersInstructionArgs,
  createUpdateCloneParametersInstruction,
  createWrapAssetInstruction,
  createUnwrapOnassetInstruction,
  createInitializePoolsInstruction,
  createInitializeOraclesInstruction,
  createUpdateOraclesInstruction,
  createAddPoolInstruction,
  UpdateOraclesInstructionArgs,
  Pools,
  Oracles,
  PaymentType,
  createLiquidateCometCollateralIldInstruction,
  createLiquidateCometOnassetIldInstruction,
  createRemoveCometPositionInstruction,
} from "../generated/clone";
import { floorToScale } from "./utils";
import Decimal from "decimal.js";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
export const CLONE_TOKEN_SCALE = 8;
export const MAX_PRICE_SIZE = 128;
export const ONUSD_COLLATERAL_INDEX = 0;
export const USDC_COLLATERAL_INDEX = 1;

export const toScale = (x: number, scale: number): BN => {
  const dec = new Decimal(String(x));
  const sDec = new Decimal(String(scale));
  const result = dec.mul(Decimal.pow(new Decimal(10), sDec)).floor().toString()
  return new BN(result)
};

export const toCloneScale = (x: number): BN => {
  return toScale(x, CLONE_TOKEN_SCALE);
};

export const fromScale = (
  x: number | beet.bignum | BN | bigint,
  scale: number | beet.bignum | BN | bigint
) => {
  const dec = new Decimal(String(x));
  const sDec = new Decimal(String(scale));
  const result = dec.mul(Decimal.pow(new Decimal(10), -sDec))
  return Number(result)
};

export const fromCloneScale = (x: number | beet.bignum | BN | bigint) => {
  return fromScale(x, CLONE_TOKEN_SCALE);
};

export class CloneClient {
  clone: Clone;
  cloneAddress: PublicKey;
  poolsAddress: PublicKey;
  oraclesAddress: PublicKey;
  programId: PublicKey;
  provider: Provider;
  opts?: ConfirmOptions;

  public constructor(
    provider: Provider,
    clone: Clone,
    programId: PublicKey,
    opts?: ConfirmOptions
  ) {
    this.programId = programId;
    this.provider = provider;
    this.clone = clone;
    this.opts = opts;
    this.cloneAddress = this.getCloneAddress();
    this.poolsAddress = this.getPoolsAddress();
    this.oraclesAddress = this.getOraclesAddress();
  }

  /// Admin RPC methods ///

  public static async createInitializeCloneTransaction(
    admin: PublicKey,
    programId: PublicKey,
    cometCollateralIldLiquidatorFeeBps: number,
    cometOnassetIldLiquidatorFeeBps: number,
    borrowLiquidatorFeeBps: number,
    treasuryAddress: PublicKey,
    collateralMint: PublicKey,
    collateralOracleIndex: number,
    collateralizationRatio: number
  ) {
    const [cloneAddress, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("clone")],
      programId
    );
    const [poolsAddress, ___] = PublicKey.findProgramAddressSync(
      [Buffer.from("pools")],
      programId
    );
    const [oraclesAddress, ____] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracles")],
      programId
    );

    const collateralVault = await getAssociatedTokenAddress(
      collateralMint,
      cloneAddress,
      true
    );

    // Use SystemProgram to create TokenData account.
    return new Transaction().add(
      createAssociatedTokenAccountInstruction(
        admin,
        collateralVault,
        cloneAddress,
        collateralMint
      ),
      createInitializeCloneInstruction(
        {
          admin,
          clone: cloneAddress,
          collateralMint,
          collateralVault,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        {
          cometCollateralIldLiquidatorFeeBps,
          cometOnassetIldLiquidatorFeeBps,
          borrowLiquidatorFeeBps,
          treasuryAddress,
          collateralOracleIndex,
          collateralizationRatio,
        },
        programId
      ),
      createInitializePoolsInstruction(
        {
          admin,
          clone: cloneAddress,
          pools: poolsAddress,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        programId
      ),
      createInitializeOraclesInstruction(
        {
          admin,
          clone: cloneAddress,
          oracles: oraclesAddress,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        programId
      )
    );
  }

  public static async initializeClone(
    provider: anchor.AnchorProvider,
    programId: PublicKey,
    cometCollateralIldLiquidatorFeeBps: number,
    cometOnassetIldLiquidatorFeeBps: number,
    borrowLiquidatorFeeBps: number,
    treasuryAddress: PublicKey,
    collateralMint: PublicKey,
    collateralOracleIndex: number,
    collateralizationRatio: number
  ) {
    let tx = await this.createInitializeCloneTransaction(
      provider.publicKey!,
      programId,
      cometCollateralIldLiquidatorFeeBps,
      cometOnassetIldLiquidatorFeeBps,
      borrowLiquidatorFeeBps,
      treasuryAddress,
      collateralMint,
      collateralOracleIndex,
      collateralizationRatio
    )
    await provider.sendAndConfirm!(tx);
  }

  public async addPool(
    minOvercollateralRatio: number,
    maxLiquidationOvercollateralRatio: number,
    liquidityTradingFeeBps: number,
    treasuryTradingFeeBps: number,
    ilHealthScoreCoefficient: number,
    positionHealthScoreCoefficient: number,
    oracleIndex: number,
    underlyingAssetMint: PublicKey
  ) {
    const onassetMint = anchor.web3.Keypair.generate();
    const onassetTokenAccount = await getAssociatedTokenAddress(
      onassetMint.publicKey,
      this.cloneAddress,
      true
    );
    const underlyingAssetTokenAddress = await getAssociatedTokenAddress(
      underlyingAssetMint,
      this.cloneAddress,
      true
    );

    let txn = new Transaction();
    txn.add(
      // create onasset mint account
      SystemProgram.createAccount({
        fromPubkey: this.provider.publicKey!,
        newAccountPubkey: onassetMint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(
          this.provider.connection
        ),
        programId: TOKEN_PROGRAM_ID,
      }),
      // init clone mint account
      createInitializeMintInstruction(
        onassetMint.publicKey,
        CLONE_TOKEN_SCALE,
        this.cloneAddress,
        null
      ),
      createAssociatedTokenAccountInstruction(
        this.provider.publicKey!,
        onassetTokenAccount,
        this.cloneAddress,
        onassetMint.publicKey
      )
    );

    try {
      const _underlyingAssetTokenAccount = await getAccount(
        this.provider.connection,
        underlyingAssetTokenAddress
      );
    } catch {
      txn.add(
        createAssociatedTokenAccountInstruction(
          this.provider.publicKey!,
          underlyingAssetTokenAddress,
          this.cloneAddress,
          underlyingAssetMint
        )
      );
    }

    txn.add(
      createAddPoolInstruction(
        {
          admin: this.provider.publicKey!,
          clone: this.cloneAddress,
          pools: this.poolsAddress,
          onassetMint: onassetMint.publicKey,
          onassetTokenAccount,
          underlyingAssetMint,
          underlyingAssetTokenAccount: underlyingAssetTokenAddress,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        {
          minOvercollateralRatio,
          maxLiquidationOvercollateralRatio,
          liquidityTradingFeeBps,
          treasuryTradingFeeBps,
          ilHealthScoreCoefficient,
          positionHealthScoreCoefficient,
          oracleInfoIndex: oracleIndex,
        },
        this.programId
      )
    );

    await this.provider.sendAndConfirm!(txn, [onassetMint], this.opts);
  }

  public async updateOracles(params: UpdateOraclesInstructionArgs) {
    let tx = new Transaction().add(
      createUpdateOraclesInstruction(
        {
          auth: this.provider.publicKey!,
          clone: this.cloneAddress,
          oracles: this.oraclesAddress,
        },
        params,
        this.programId
      )
    );
    await this.provider.sendAndConfirm!(tx);
  }

  public async updateCloneParameters(
    params: UpdateCloneParametersInstructionArgs
  ) {
    let ix = createUpdateCloneParametersInstruction(
      {
        admin: this.provider.publicKey!,
        clone: this.cloneAddress,
      },
      params,
      this.programId
    );
    await this.provider.sendAndConfirm!(new Transaction().add(ix));
  }

  public async updatePoolParameters(
    params: UpdatePoolParametersInstructionArgs
  ) {
    let ix = createUpdatePoolParametersInstruction(
      {
        auth: this.provider.publicKey!,
        clone: this.cloneAddress,
        pools: this.poolsAddress,
      },
      params,
      this.programId
    );
    await this.provider.sendAndConfirm!(new Transaction().add(ix));
  }

  /// Address and account fetching ///

  public getCloneAddress(): PublicKey {
    const [address, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("clone")],
      this.programId
    );
    return address;
  }

  public getPoolsAddress(): PublicKey {
    const [address, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("pools")],
      this.programId
    );
    return address;
  }

  public getOraclesAddress(): PublicKey {
    const [address, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracles")],
      this.programId
    );
    return address;
  }

  public getUserAccountAddress(authority?: PublicKey) {
    const [userPubkey, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), (authority ?? this.provider.publicKey!).toBuffer()],
      this.programId
    );
    return userPubkey;
  }

  public async getCloneAccount(): Promise<Clone> {
    return await Clone.fromAccountAddress(
      this.provider.connection,
      this.cloneAddress
    );
  }

  public async getPools(): Promise<Pools> {
    return await Pools.fromAccountAddress(
      this.provider.connection,
      this.poolsAddress
    );
  }

  public async getOracles(): Promise<Oracles> {
    return await Oracles.fromAccountAddress(
      this.provider.connection,
      this.oraclesAddress
    );
  }

  public async getUserAccount(authority?: PublicKey): Promise<User> {
    return await User.fromAccountAddress(
      this.provider.connection,
      this.getUserAccountAddress(authority)
    );
  }

  /// Instruction creation methods ///

  public initializeUserInstruction(
    authority?: PublicKey
  ): TransactionInstruction {
    const userAccountAddress = this.getUserAccountAddress(authority);

    return createInitializeUserInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: userAccountAddress,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      {
        authority: authority ?? this.provider.publicKey!,
      },
      this.programId
    );
  }

  public updatePricesInstruction(
    oracles: Oracles,
    indices?: number[]
  ): TransactionInstruction {
    let anchorRemainingAccounts: anchor.web3.AccountMeta[] = [];

    let oracleIndices: Uint8Array;

    if (indices && indices.length > 0) {
      indices.forEach((index) => {
        anchorRemainingAccounts.push({
          pubkey: oracles.oracles[index].address,
          isWritable: false,
          isSigner: false,
        });
      });
      oracleIndices = new Uint8Array(indices);
    } else {
      let temp: number[] = [];
      oracles.oracles.forEach((oracle, index) => {
        temp.push(index);
        anchorRemainingAccounts.push({
          pubkey: oracle.address,
          isWritable: false,
          isSigner: false,
        });
      });
      oracleIndices = new Uint8Array(temp);
    }

    return createUpdatePricesInstruction(
      {
        oracles: this.oraclesAddress,
        anchorRemainingAccounts,
      },
      { oracleIndices },
      this.programId
    );
  }

  public wrapAssetInstruction(
    pools: Pools,
    amount: BN,
    poolIndex: number,
    assetMint: PublicKey,
    userAssetTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey
  ): TransactionInstruction {
    const pool = pools.pools[poolIndex];
    return createWrapAssetInstruction(
      {
        user: this.provider.publicKey!,
        pools: this.poolsAddress,
        underlyingAssetTokenAccount: pool.underlyingAssetTokenAccount!,
        assetMint,
        userAssetTokenAccount,
        onassetMint: pool.assetInfo.onassetMint,
        userOnassetTokenAccount,
        clone: this.cloneAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount,
        poolIndex,
      },
      this.programId
    );
  }

  public unwrapOnassetInstruction(
    pools: Pools,
    amount: BN,
    poolIndex: number,
    assetMint: PublicKey,
    userAssetTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey
  ): TransactionInstruction {
    let pool = pools.pools[poolIndex];
    return createUnwrapOnassetInstruction(
      {
        user: this.provider.publicKey!,
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        underlyingAssetTokenAccount: pool.underlyingAssetTokenAccount!,
        assetMint,
        userAssetTokenAccount,
        onassetMint: pool.assetInfo.onassetMint,
        userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount,
        poolIndex,
      },
      this.programId
    );
  }

  public initializeBorrowPositionInstruction(
    pools: Pools,
    userCollateralTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number
  ): TransactionInstruction {
    return createInitializeBorrowPositionInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        vault: this.clone.collateral.vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        onassetMint: pools.pools[poolIndex].assetInfo.onassetMint,
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        poolIndex,
        onassetAmount,
        collateralAmount,
      },
      this.programId
    );
  }

  public addCollateralToBorrowInstruction(
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    return createAddCollateralToBorrowInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        vault: this.clone.collateral.vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        borrowIndex,
        amount: collateralAmount,
      },
      this.programId
    );
  }

  public withdrawCollateralFromBorrowInstruction(
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    return createWithdrawCollateralFromBorrowInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        vault: this.clone.collateral.vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        borrowIndex,
        amount: collateralAmount,
      },
      this.programId
    );
  }

  public payBorrowDebtInstruction(
    pools: Pools,
    userAccount: User,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ): TransactionInstruction {
    let assetInfo =
      pools.pools[Number(userAccount.borrows[borrowIndex].poolIndex)].assetInfo;

    return createPayBorrowDebtInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        onassetMint: assetInfo.onassetMint,
        payerOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { user: this.provider.publicKey!, borrowIndex, amount: onassetAmount },
      this.programId
    );
  }

  public borrowMoreInstruction(
    pools: Pools,
    userAccount: User,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ): TransactionInstruction {
    let assetInfo =
      pools.pools[Number(userAccount.borrows[borrowIndex].poolIndex)].assetInfo;

    return createBorrowMoreInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        onassetMint: assetInfo.onassetMint,
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { borrowIndex, amount: onassetAmount },
      this.programId
    );
  }

  public swapInstruction(
    poolIndex: number,
    quantity: BN,
    quantityIsInput: boolean,
    quantityIsCollateral: boolean,
    threshold: BN,
    onassetMint: PublicKey,
    userCollateralTokenAddress: PublicKey,
    userOnassetTokenAddress: PublicKey,
    treasuryCollateralTokenAddress: PublicKey,
    treasuryOnassetTokenAddress: PublicKey,
    cloneStakingConfig?: {
      cloneStakingProgram: PublicKey;
      cloneStaking: PublicKey;
      userStakingAccount: PublicKey;
    },
    remainingAccounts?: PublicKey[],
  ): TransactionInstruction {
    const { cloneStakingProgram, cloneStaking, userStakingAccount } =
      cloneStakingConfig ?? {
        cloneStakingProgram: this.programId,
        cloneStaking: this.programId,
        userStakingAccount: this.programId,
      };
    const anchorRemainingAccounts = remainingAccounts ? remainingAccounts.map(pubkey => {
      return { pubkey, isSigner: false, isWritable: false };
    }) : []
    return createSwapInstruction(
      {
        user: this.provider.publicKey!,
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        userOnassetTokenAccount: userOnassetTokenAddress,
        userCollateralTokenAccount: userCollateralTokenAddress,
        treasuryCollateralTokenAccount: treasuryCollateralTokenAddress,
        treasuryOnassetTokenAccount: treasuryOnassetTokenAddress,
        collateralMint: this.clone.collateral.mint,
        onassetMint,
        collateralVault: this.clone.collateral.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        cloneStaking: cloneStaking,
        cloneStakingProgram: cloneStakingProgram,
        userStakingAccount: userStakingAccount,
        anchorRemainingAccounts
      },
      {
        poolIndex,
        quantity,
        quantityIsInput,
        quantityIsCollateral,
        resultThreshold: threshold,
      },
      this.programId
    );
  }

  public addCollateralToCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    return createAddCollateralToCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        vault: this.clone.collateral.vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        collateralAmount,
      },
      this.programId
    );
  }

  public withdrawCollateralFromCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    return createWithdrawCollateralFromCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        vault: this.clone.collateral.vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        collateralAmount,
      },
      this.programId
    );
  }

  public addLiquidityToCometInstruction(
    collateralAmount: BN,
    poolIndex: number
  ): TransactionInstruction {
    return createAddLiquidityToCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
      },
      { poolIndex, collateralAmount },
      this.programId
    );
  }

  public withdrawLiquidityFromCometInstruction(
    amount: BN,
    cometPositionIndex: number
  ): TransactionInstruction {
    return createWithdrawLiquidityFromCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
      },
      { cometPositionIndex, amount },
      this.programId
    );
  }

  public payCometILDInstruction(
    pools: Pools,
    userAccount: User,
    cometPositionIndex: number,
    authorizedAmount: BN,
    paymentType: PaymentType,
    payerOnassetTokenAccount: PublicKey,
    payerCollateralTokenAccount: PublicKey
  ): TransactionInstruction {
    const onassetMint =
      pools.pools[userAccount.comet.positions[cometPositionIndex].poolIndex]
        .assetInfo.onassetMint;

    return createPayImpermanentLossDebtInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        collateralMint: this.clone.collateral.mint,
        collateralVault: this.clone.collateral.vault,
        onassetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        payerOnassetTokenAccount,
        payerCollateralTokenAccount,
      },
      {
        user: this.provider.publicKey!,
        cometPositionIndex,
        amount: authorizedAmount,
        paymentType,
      },
      this.programId
    );
  }

  public liquidateCometCollateralILDInstruction(
    liquidateeAddress: PublicKey,
    cometPositionIndex: number,
    liquidatorCollateralTokenAccount: PublicKey
  ): TransactionInstruction {
    return createLiquidateCometCollateralIldInstruction(
      {
        liquidator: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(liquidateeAddress),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        collateralMint: this.clone.collateral.mint,
        liquidatorCollateralTokenAccount,
        vault: this.clone.collateral.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        user: liquidateeAddress,
        cometPositionIndex,
      },
      this.programId
    );
  }

  public liquidateCometOnassetILDInstruction(
    pools: Pools,
    liquidateeUserAccount: User,
    liquidateeAddress: PublicKey,
    cometPositionIndex: number,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatorOnassetTokenAccount: PublicKey,
    amount: BN
  ): TransactionInstruction {
    const cometPosition =
      liquidateeUserAccount.comet.positions[cometPositionIndex];
    const pool = pools.pools[Number(cometPosition.poolIndex)];

    return createLiquidateCometOnassetIldInstruction(
      {
        liquidator: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(liquidateeAddress),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        onassetMint: pool.assetInfo.onassetMint,
        liquidatorOnassetTokenAccount,
        liquidatorCollateralTokenAccount,
        vault: this.clone.collateral.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        user: liquidateeAddress,
        cometPositionIndex,
        amount,
      },
      this.programId
    );
  }

  public liquidateBorrowPositionInstruction(
    pools: Pools,
    liquidateeUserAccount: User,
    liquidateeAddress: PublicKey,
    borrowIndex: number,
    amount: BN,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatorOnassetTokenAccount: PublicKey
  ): TransactionInstruction {
    const borrowPosition = liquidateeUserAccount.borrows[borrowIndex];
    const pool = pools.pools[Number(borrowPosition.poolIndex)];

    return createLiquidateBorrowPositionInstruction(
      {
        liquidator: this.provider.publicKey!,
        clone: this.cloneAddress,
        userAccount: this.getUserAccountAddress(liquidateeAddress),
        pools: this.poolsAddress,
        oracles: this.oraclesAddress,
        onassetMint: pool.assetInfo.onassetMint,
        vault: this.clone.collateral.vault,
        liquidatorCollateralTokenAccount: liquidatorCollateralTokenAccount,
        liquidatorOnassetTokenAccount: liquidatorOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        user: liquidateeAddress,
        borrowIndex,
        amount,
      },
      this.programId
    );
  }

  public collectLpRewardsInstruction(
    pools: Pools,
    userAccount: User,
    userCollateralTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey,
    cometPositionIndex: number
  ): TransactionInstruction {
    const poolIndex = Number(
      userAccount.comet.positions[cometPositionIndex].poolIndex
    );

    return createCollectLpRewardsInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        clone: this.cloneAddress,
        pools: this.poolsAddress,
        collateralVault: this.clone.collateral.vault,
        onassetMint: pools.pools[poolIndex].assetInfo.onassetMint,
        userCollateralTokenAccount,
        userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { cometPositionIndex },
      this.programId
    );
  }

  public removeCometPositionInstruction(cometPositionIndex: number): TransactionInstruction {
    return createRemoveCometPositionInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: this.getUserAccountAddress(),
        pools: this.poolsAddress,
      }, {
        cometPositionIndex,
      },
      this.programId
    )
  }
}
