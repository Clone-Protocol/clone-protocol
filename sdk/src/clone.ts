import * as anchor from "@coral-xyz/anchor";
import * as beet from "@metaplex-foundation/beet";
import { BN, Provider } from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
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
  TokenData,
  createInitializeUserInstruction,
  createUpdatePricesInstruction,
  createMintOnusdInstruction,
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
  createLiquidateCometPositionInstruction,
  createLiquidateBorrowPositionInstruction,
  createCollectLpRewardsInstruction,
  createInitializeBorrowPositionInstruction,
  createInitializePoolInstruction,
  createAddCollateralInstruction,
  createInitializeCloneInstruction,
  UpdatePoolParametersInstructionArgs,
  createUpdatePoolParametersInstruction,
  UpdateCollateralParametersInstructionArgs,
  createUpdateCollateralParametersInstruction,
  UpdateCloneParametersInstructionArgs,
  createUpdateCloneParametersInstruction,
  createAddOracleFeedInstruction,
  createWrapAssetInstruction,
  createUnwrapOnassetInstruction,
  createInitializeTokenDataInstruction,
  createReallocateTokenDataInstruction,
} from "../generated/clone";
import { getOrCreateAssociatedTokenAccount } from "./utils";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
export const CLONE_TOKEN_SCALE = 8;
export const MAX_PRICE_SIZE = 128;

export const toScale = (x: number, scale: number): BN => {
  let stringDigits = [];
  let stringX = String(x);
  let foundDecimal = false;
  let digitsAfterDecimal = scale;

  for (const digit of stringX) {
    if (digitsAfterDecimal === 0) break;
    if (digit === ".") {
      foundDecimal = true;
      continue;
    }
    stringDigits.push(digit);
    if (foundDecimal) {
      digitsAfterDecimal -= 1;
    }
  }
  return new BN(stringDigits.join("").concat("0".repeat(digitsAfterDecimal)));
};

export const toCloneScale = (x: number): BN => {
  return toScale(x, CLONE_TOKEN_SCALE);
};

export const fromScale = (
  x: number | beet.bignum | BN | bigint,
  scale: number | beet.bignum | BN | bigint
) => {
  return Number(x) * Math.pow(10, -Number(scale));
};

export const fromCloneScale = (x: number | beet.bignum | BN | bigint) => {
  return fromScale(x, CLONE_TOKEN_SCALE);
};

export class CloneClient {
  clone: Clone;
  cloneAddress: PublicKey;
  tokenDataAddress: PublicKey;
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
    this.tokenDataAddress = this.getTokenDataAddress();
  }

  /// Admin RPC methods ///

  public static async initializeClone(
    provider: anchor.AnchorProvider,
    programId: PublicKey,
    cometLiquidatorFeeBps: number,
    borrowLiquidatorFeeBps: number,
    treasuryAddress: PublicKey,
    usdcMint: PublicKey,
    onusdMint: PublicKey
  ) {
    const [cloneAddress, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("clone")],
      programId
    );
    const [tokenDataAddress, __] = PublicKey.findProgramAddressSync(
      [Buffer.from("token-data")],
      programId
    );

    // Use SystemProgram to create TokenData account.
    let tx = new Transaction().add(
      createInitializeCloneInstruction(
        {
          admin: provider.publicKey!,
          clone: cloneAddress,
          onusdMint,
          usdcMint,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        {
          cometLiquidatorFeeBps,
          borrowLiquidatorFeeBps,
          treasuryAddress,
        }
      ),
      createInitializeTokenDataInstruction({
        admin: provider.publicKey!,
        clone: cloneAddress,
        tokenData: tokenDataAddress,
        systemProgram: SYSTEM_PROGRAM_ID,
      }),
      createReallocateTokenDataInstruction(
        {
          admin: provider.publicKey!,
          clone: cloneAddress,
          tokenData: tokenDataAddress,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        {
          len: 16408 + 8,
        }
      )
    );
    await provider.sendAndConfirm!(tx);
  }

  public async initializePool(
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
    const underlyingAssetTokenAccount = await getAssociatedTokenAddress(
      underlyingAssetMint,
      this.cloneAddress,
      true
    );

    await this.provider.sendAndConfirm!(
      new Transaction().add(
        // create onusd mint account
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
        ),
        createAssociatedTokenAccountInstruction(
          this.provider.publicKey!,
          underlyingAssetTokenAccount,
          this.cloneAddress,
          underlyingAssetMint
        )
      ),
      [onassetMint],
      this.opts
    );

    await this.provider.sendAndConfirm!(
      new Transaction().add(
        createInitializePoolInstruction(
          {
            admin: this.provider.publicKey!,
            clone: this.cloneAddress,
            tokenData: this.tokenDataAddress,
            onusdMint: this.clone!.onusdMint,
            onassetMint: onassetMint.publicKey,
            onassetTokenAccount,
            underlyingAssetMint,
            underlyingAssetTokenAccount,
            systemProgram: SYSTEM_PROGRAM_ID,
          },
          {
            minOvercollateralRatio,
            maxLiquidationOvercollateralRatio,
            liquidityTradingFeeBps,
            treasuryTradingFeeBps,
            ilHealthScoreCoefficient: toCloneScale(ilHealthScoreCoefficient),
            positionHealthScoreCoefficient: toCloneScale(
              positionHealthScoreCoefficient
            ),
            oracleInfoIndex: oracleIndex,
          }
        )
      ),
      [],
      this.opts
    );
  }

  public async addCollateral(
    collateralMint: PublicKey,
    collateralizationRatio: number = 0,
    oracleInfoIndex: number = 255
  ) {
    const vaultAccount = await getOrCreateAssociatedTokenAccount(
      this.provider,
      collateralMint,
      this.cloneAddress,
      true
    );
    let tx = new Transaction();

    tx.add(
      createAddCollateralInstruction(
        {
          admin: this.provider.publicKey!,
          clone: this.cloneAddress,
          tokenData: this.tokenDataAddress,
          collateralMint,
          vault: vaultAccount.address,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        {
          collateralizationRatio,
          oracleInfoIndex,
        }
      )
    );

    await this.provider.sendAndConfirm!(tx, [], this.opts);
  }

  public async addOracleInfo(pythFeedAddress: PublicKey) {
    let tx = new Transaction().add(
      createAddOracleFeedInstruction(
        {
          admin: this.provider.publicKey!,
          clone: this.cloneAddress,
          tokenData: this.tokenDataAddress,
        },
        {
          pythAddress: pythFeedAddress,
        }
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
      params
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
        tokenData: this.tokenDataAddress,
      },
      params
    );
    await this.provider.sendAndConfirm!(new Transaction().add(ix));
  }

  public async updateCollateralParameters(
    params: UpdateCollateralParametersInstructionArgs
  ) {
    let ix = createUpdateCollateralParametersInstruction(
      {
        admin: this.provider.publicKey!,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
      },
      params
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

  public getTokenDataAddress(): PublicKey {
    const [address, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("token-data")],
      this.programId
    );
    return address;
  }

  public getUserAddress(address?: PublicKey) {
    const [userPubkey, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), (address ?? this.provider.publicKey!).toBuffer()],
      this.programId
    );
    return { userPubkey, bump };
  }

  public async getCloneAccount(): Promise<Clone> {
    return await Clone.fromAccountAddress(
      this.provider.connection,
      this.cloneAddress
    );
  }

  public async getTokenData(): Promise<TokenData> {
    return await TokenData.fromAccountAddress(
      this.provider.connection,
      this.tokenDataAddress
    );
  }

  public async getUserAccount(address?: PublicKey): Promise<User> {
    if (!address) {
      const { userPubkey } = this.getUserAddress();
      address = userPubkey;
    }
    return await User.fromAccountAddress(this.provider.connection, address);
  }

  /// Instruction creation methods ///

  public initializeUserInstruction(
    authority?: PublicKey
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress(authority);

    return createInitializeUserInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: userPubkey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      {
        authority: authority ?? this.provider.publicKey!,
      }
    );
  }

  public updatePricesInstruction(
    tokenData: TokenData,
    poolIndices?: number[]
  ): TransactionInstruction {
    let arr = [];
    for (let i = 0; i < tokenData.numOracles.toNumber(); i++) {
      arr.push(i);
    }
    let indices = poolIndices ? poolIndices : arr;

    let anchorRemainingAccounts: anchor.web3.AccountMeta[] = [];

    indices.forEach((index) => {
      anchorRemainingAccounts.push({
        pubkey: tokenData.oracles[index].pythAddress,
        isWritable: false,
        isSigner: false,
      });
    });

    let zero_padding = MAX_PRICE_SIZE - indices.length;
    for (let i = 0; i < zero_padding; i++) {
      indices.push(0);
    }

    return createUpdatePricesInstruction(
      {
        tokenData: this.tokenDataAddress,
        anchorRemainingAccounts,
      },
      { indices: { indices: indices } }
    );
  }

  public mintOnusdInstruction(
    tokenData: TokenData,
    amount: BN,
    userOnusdTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey
  ): TransactionInstruction {
    return createMintOnusdInstruction(
      {
        user: this.provider.publicKey!,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        usdcVault: tokenData.collaterals[1].vault,
        onusdMint: this.clone!.onusdMint,
        userOnusdTokenAccount: userOnusdTokenAccount,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { amount }
    );
  }

  public wrapAssetInstruction(
    tokenData: TokenData,
    amount: BN,
    poolIndex: number,
    assetMint: PublicKey,
    userAssetTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey
  ): TransactionInstruction {
    const pool = tokenData.pools[poolIndex];
    return createWrapAssetInstruction(
      {
        user: this.provider.publicKey!,
        tokenData: this.tokenDataAddress,
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
      }
    );
  }

  public unwrapOnassetInstruction(
    tokenData: TokenData,
    amount: BN,
    poolIndex: number,
    assetMint: PublicKey,
    userAssetTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey
  ): TransactionInstruction {
    const pool = tokenData.pools[poolIndex];
    return createUnwrapOnassetInstruction(
      {
        user: this.provider.publicKey!,
        tokenData: this.tokenDataAddress,
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
      }
    );
  }

  public initializeBorrowPositionInstruction(
    tokenData: TokenData,
    userCollateralTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();

    return createInitializeBorrowPositionInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        poolIndex,
        collateralIndex,
        onassetAmount,
        collateralAmount,
      }
    );
  }

  public addCollateralToBorrowInstruction(
    tokenData: TokenData,
    userAccount: User,
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();

    return createAddCollateralToBorrowInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        vault:
          tokenData.collaterals[
            Number(userAccount.borrows.positions[borrowIndex].collateralIndex)
          ].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        borrowIndex,
        amount: collateralAmount,
      }
    );
  }

  public withdrawCollateralFromBorrowInstruction(
    tokenData: TokenData,
    userAccount: User,
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();

    return createWithdrawCollateralFromBorrowInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        vault:
          tokenData.collaterals[
            Number(userAccount.borrows.positions[borrowIndex].collateralIndex)
          ].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        borrowIndex,
        amount: collateralAmount,
      }
    );
  }

  public payBorrowDebtInstruction(
    tokenData: TokenData,
    userAccount: User,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ): TransactionInstruction {
    let assetInfo =
      tokenData.pools[
        Number(userAccount.borrows.positions[borrowIndex].poolIndex)
      ].assetInfo;
    const { userPubkey } = this.getUserAddress();

    return createPayBorrowDebtInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        onassetMint: assetInfo.onassetMint,
        payerOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { user: this.provider.publicKey!, borrowIndex, amount: onassetAmount }
    );
  }

  public borrowMoreInstruction(
    tokenData: TokenData,
    userAccount: User,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    borrowIndex: number
  ): TransactionInstruction {
    let assetInfo =
      tokenData.pools[userAccount.borrows.positions[borrowIndex].poolIndex]
        .assetInfo;
    const { userPubkey } = this.getUserAddress();

    return createBorrowMoreInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        onassetMint: assetInfo.onassetMint,
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { borrowIndex, amount: onassetAmount }
    );
  }

  public swapInstruction(
    poolIndex: number,
    quantity: BN,
    quantityIsInput: boolean,
    quantityIsOnusd: boolean,
    threshold: BN,
    onassetMint: PublicKey,
    userOnusdTokenAddress: PublicKey,
    userOnassetTokenAddress: PublicKey,
    treasuryOnusdTokenAddress: PublicKey,
    treasuryOnassetTokenAddress: PublicKey,
    cloneStakingConfig?: {
      cloneStakingProgram: PublicKey;
      cloneStaking: PublicKey;
      userStakingAccount: PublicKey;
    }
  ): TransactionInstruction {
    const { cloneStakingProgram, cloneStaking, userStakingAccount } =
      cloneStakingConfig ?? {
        cloneStakingProgram: this.programId,
        cloneStaking: this.programId,
        userStakingAccount: this.programId,
      };
    return createSwapInstruction(
      {
        user: this.provider.publicKey!,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        userOnassetTokenAccount: userOnassetTokenAddress,
        userOnusdTokenAccount: userOnusdTokenAddress,
        treasuryOnusdTokenAccount: treasuryOnusdTokenAddress,
        treasuryOnassetTokenAccount: treasuryOnassetTokenAddress,
        onusdMint: this.clone!.onusdMint,
        onassetMint: onassetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        cloneStaking: cloneStaking,
        cloneStakingProgram: cloneStakingProgram,
        userStakingAccount: userStakingAccount,
      },
      {
        poolIndex,
        quantity,
        quantityIsInput,
        quantityIsOnusd,
        resultThreshold: threshold,
      }
    );
  }

  public addCollateralToCometInstruction(
    tokenData: TokenData,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();

    return createAddCollateralToCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        tokenData: this.tokenDataAddress,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        collateralIndex,
        collateralAmount,
      }
    );
  }

  public withdrawCollateralFromCometInstruction(
    tokenData: TokenData,
    userAccount: User,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometCollateralIndex: number
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();

    return createWithdrawCollateralFromCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        vault:
          tokenData.collaterals[
            userAccount.comet.collaterals[cometCollateralIndex].collateralIndex
          ].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        cometCollateralIndex,
        collateralAmount,
      }
    );
  }

  public addLiquidityToCometInstruction(
    onusdAmount: BN,
    poolIndex: number
  ): TransactionInstruction {
    let { userPubkey } = this.getUserAddress();

    return createAddLiquidityToCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
      },
      { poolIndex, onusdAmount }
    );
  }

  public withdrawLiquidityFromCometInstruction(
    onusdWithdrawal: BN,
    cometPositionIndex: number
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();

    return createWithdrawLiquidityFromCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
      },
      { cometPositionIndex, onusdAmount: onusdWithdrawal }
    );
  }

  public payCometILDInstruction(
    tokenData: TokenData,
    userAccount: User,
    cometPositionIndex: number,
    authorizedAmount: BN,
    payOnusdDebt: boolean,
    payerOnassetTokenAccount: PublicKey,
    payerOnusdTokenAccount: PublicKey
  ): TransactionInstruction {
    const cometPosition = userAccount.comet.positions[cometPositionIndex];
    const { userPubkey } = this.getUserAddress();

    return createPayImpermanentLossDebtInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        onusdMint: this.clone!.onusdMint,
        onassetMint:
          tokenData.pools[cometPosition.poolIndex].assetInfo.onassetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        payerOnassetTokenAccount: payerOnassetTokenAccount,
        payerOnusdTokenAccount: payerOnusdTokenAccount,
      },
      {
        user: this.provider.publicKey!,
        cometPositionIndex,
        amount: authorizedAmount,
        payOnusdDebt,
      }
    );
  }

  public liquidateCometPositionInstruction(
    tokenData: TokenData,
    liquidateeUserAccount: User,
    liquidateeAddress: PublicKey,
    cometPositionIndex: number,
    cometCollateralIndex: number,
    amount: BN,
    payOnusdDebt: boolean,
    liquidatorOnusdTokenAccount: PublicKey,
    liquidatorOnassetTokenAccount: PublicKey,
    liquidatorCollateralTokenAccount: PublicKey
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress(liquidateeAddress);
    const cometPosition =
      liquidateeUserAccount.comet.positions[cometPositionIndex];
    const cometCollateral =
      liquidateeUserAccount.comet.collaterals[cometCollateralIndex];
    const pool = tokenData.pools[cometPosition.poolIndex];
    const collateral = tokenData.collaterals[cometCollateral.collateralIndex];

    return createLiquidateCometPositionInstruction(
      {
        liquidator: this.provider.publicKey!,
        user: liquidateeAddress,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        onusdMint: this.clone!.onusdMint,
        onassetMint: pool.assetInfo.onassetMint,
        liquidatorOnusdTokenAccount: liquidatorOnusdTokenAccount,
        liquidatorOnassetTokenAccount: liquidatorOnassetTokenAccount,
        liquidatorCollateralTokenAccount: liquidatorCollateralTokenAccount,
        vault: collateral.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        cometPositionIndex,
        cometCollateralIndex,
        amount,
        payOnusdDebt,
      }
    );
  }

  public liquidateBorrowPositionInstruction(
    tokenData: TokenData,
    liquidateeUserAccount: User,
    liquidateeAddress: PublicKey,
    borrowIndex: number,
    amount: BN,
    liquidatorCollateralTokenAccount: PublicKey,
    liquidatorOnassetTokenAccount: PublicKey
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress(liquidateeAddress);
    const borrowPosition = liquidateeUserAccount.borrows.positions[borrowIndex];
    const pool = tokenData.pools[borrowPosition.poolIndex];
    const collateral = tokenData.collaterals[borrowPosition.collateralIndex];

    return createLiquidateBorrowPositionInstruction(
      {
        liquidator: this.provider.publicKey!,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        userAccount: userPubkey,
        user: liquidateeAddress,
        onassetMint: pool.assetInfo.onassetMint,
        vault: collateral.vault,
        liquidatorCollateralTokenAccount: liquidatorCollateralTokenAccount,
        liquidatorOnassetTokenAccount: liquidatorOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        borrowIndex,
        amount,
      }
    );
  }

  public collectLpRewardsInstruction(
    tokenData: TokenData,
    userAccount: User,
    userOnusdTokenAccount: PublicKey,
    onassetTokenAccountInfo: PublicKey,
    cometPositionIndex: number
  ): TransactionInstruction {
    const { userPubkey } = this.getUserAddress();
    const poolIndex = Number(
      userAccount.comet.positions[cometPositionIndex].poolIndex
    );
    const pool = tokenData.pools[poolIndex];

    return createCollectLpRewardsInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userPubkey,
        clone: this.cloneAddress,
        tokenData: this.tokenDataAddress,
        onusdMint: this.clone!.onusdMint,
        onassetMint: pool.assetInfo.onassetMint,
        userOnusdTokenAccount: userOnusdTokenAccount,
        userOnassetTokenAccount: onassetTokenAccountInfo,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { cometPositionIndex }
    );
  }
}
