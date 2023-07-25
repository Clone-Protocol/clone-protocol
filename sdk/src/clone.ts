import * as anchor from "@coral-xyz/anchor";
import { BN, Program, Provider } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Clone as CloneProgram, IDL } from "./idl/clone";
import {
  PublicKey,
  Connection,
  ConfirmOptions,
  TransactionInstruction,
} from "@solana/web3.js";
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
} from "../generated/clone";

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

export const toDevnetScale = (x: number): BN => {
  return toScale(x, CLONE_TOKEN_SCALE);
};

export class CloneClient {
  connection: Connection;
  programId: PublicKey;
  program: Program<CloneProgram>;
  clone?: Clone;
  opts?: ConfirmOptions;
  cloneAddress: PublicKey;
  provider: Provider;

  public constructor(
    programId: PublicKey,
    provider: Provider,
    opts?: ConfirmOptions
  ) {
    this.cloneAddress = this.getCloneAddress();
    this.connection = provider.connection;
    this.programId = programId;
    this.provider = provider;
    this.opts = opts;
    this.program = new Program<CloneProgram>(IDL, this.programId, provider);
  }

  public async loadClone() {
    this.clone = await this.getCloneAccount();
  }

  /// Admin RPC methods ///

  public async initializeClone(
    liquidatorFee: number,
    treasuryAddress: PublicKey,
    usdcMint: PublicKey
  ) {
    const usdcVault = anchor.web3.Keypair.generate();
    const onusdMint = anchor.web3.Keypair.generate();
    const onusdVault = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeClone(liquidatorFee, treasuryAddress)
      .accounts({
        admin: this.provider.publicKey!,
        clone: this.cloneAddress,
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

  public async initializePool(
    admin: PublicKey,
    stableCollateralRatio: number,
    cryptoCollateralRatio: number,
    liquidityTradingFee: number,
    treasuryTradingFee: number,
    ilHealthScoreCoefficient: number,
    positionHealthScoreCoefficient: number,
    liquidationDiscountRate: number,
    oracleIndex: number,
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
        oracleIndex
      )
      .accounts({
        admin: admin,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
        onusdMint: this.clone!.onusdMint,
        onusdTokenAccount: onusdTokenAccount.publicKey,
        onassetMint: onassetMintAccount.publicKey,
        onassetTokenAccount: onassetTokenAccount.publicKey,
        underlyingAssetMint: underlyingAssetMint,
        underlyingAssetTokenAccount: underlyingAssetTokenAccount.publicKey,
        liquidityTokenMint: liquidityTokenMintAccount.publicKey,
        cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers(signers)
      .rpc();
  }

  public async addCollateral(
    admin: PublicKey,
    scale: number,
    stable: boolean,
    collateral_mint: PublicKey,
    oracleIndex: number,
    liquidationDiscount: number,
    collateralization_ratio: number = 0
  ) {
    const vaultAccount = anchor.web3.Keypair.generate();

    await this.program.methods
      .addCollateral(
        scale,
        stable,
        collateralization_ratio,
        oracleIndex,
        liquidationDiscount
      )
      .accounts({
        admin: admin,
        clone: this.cloneAddress,
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

  /// Address and account fetching ///

  public getCloneAddress(): PublicKey {
    const [address, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("clone")],
      this.program.programId
    );
    return address;
  }

  public getUserAddress(address?: PublicKey) {
    if (!address) {
      address = this.provider.publicKey!;
    }

    const [userPubkey, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), address.toBuffer()],
      this.program.programId
    );
    return { userPubkey, bump };
  }

  public async getCloneAccount() {
    return await Clone.fromAccountAddress(
      this.provider.connection,
      this.cloneAddress
    );
  }

  public async getTokenData(): Promise<TokenData> {
    return await TokenData.fromAccountAddress(
      this.provider.connection,
      this.clone!.tokenData
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

  public initializeUserInstruction(user?: PublicKey): TransactionInstruction {
    const { userPubkey, bump } = this.getUserAddress(user);

    return createInitializeUserInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: userPubkey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      {
        authority: user ?? this.provider.publicKey!,
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

    let priceFeeds: Array<{
      pubkey: PublicKey;
      isWritable: boolean;
      isSigner: boolean;
    }> = [];

    indices.forEach((index) => {
      priceFeeds.push({
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
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
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
        tokenData: this.clone!.tokenData,
        usdcVault: tokenData.collaterals[1].vault,
        onusdMint: this.clone!.onusdMint,
        userOnusdTokenAccount: userOnusdTokenAccount,
        userCollateralTokenAccount: userCollateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { amount }
    );
  }

  public async initializeBorrowPositionInstruction(
    tokenData: TokenData,
    userCollateralTokenAccount: PublicKey,
    userOnassetTokenAccount: PublicKey,
    onassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let { userPubkey, bump } = this.getUserAddress();

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
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
        vault: tokenData.collaterals[collateralIndex].vault,
        userCollateralTokenAccount: userCollateralTokenAccount,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public addCollateralToBorrowInstruction(
    tokenData: TokenData,
    userAccount: User,
    borrowIndex: number,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN
  ): TransactionInstruction {
    let userAddress = this.getUserAddress();

    return createAddCollateralToBorrowInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
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
    let userAddress = this.getUserAddress();

    return createWithdrawCollateralFromBorrowInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
        vault:
          tokenData.collaterals[
            userAccount.borrows[borrowIndex].collateralIndex
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
      tokenData.pools[userAccount.borrows.positions[borrowIndex].poolIndex]
        .assetInfo;
    let userAddress = this.getUserAddress();

    return createPayBorrowDebtInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
        onassetMint: assetInfo.onassetMint,
        userOnassetTokenAccount: userOnassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      { borrowIndex, amount: onassetAmount }
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
    let userAddress = this.getUserAddress();

    return createBorrowMoreInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
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
        tokenData: this.clone!.tokenData,
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
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
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
        tokenData: this.clone!.tokenData,
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

  public addLiquidityToCometInstruction(onusdAmount: BN, poolIndex: number) {
    let userAddress = this.getUserAddress();

    return createAddLiquidityToCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
      },
      { poolIndex, onusdAmount }
    );
  }

  public withdrawLiquidityFromCometInstruction(
    onusdWithdrawal: BN,
    cometPositionIndex: number
  ): TransactionInstruction {
    let userAddress = this.getUserAddress();

    return createWithdrawLiquidityFromCometInstruction(
      {
        user: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
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
    let cometPosition = userAccount.comet.positions[cometPositionIndex];
    let userAddress = this.getUserAddress();

    return createPayImpermanentLossDebtInstruction(
      {
        payer: this.provider.publicKey!,
        userAccount: userAddress.userPubkey,
        clone: this.cloneAddress,
        tokenData: this.clone!.tokenData,
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
        tokenData: this.clone!.tokenData,
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
        tokenData: this.clone!.tokenData,
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
        tokenData: this.clone!.tokenData,
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
