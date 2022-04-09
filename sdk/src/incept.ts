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
import { sleep } from "./utils";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

const TOKEN_DATA_SIZE = 138776;
const COMET_POSITIONS_SIZE = 59208;
const MINT_POSITIONS_SIZE = 24528;
const LIQUIDITY_POSITIONS_SIZE = 16368;

export class Incept {
  connection: Connection;
  programId: PublicKey;
  program: Program<InceptProgram>;
  manager: Manager;
  tokenData: TokenData;
  opts?: ConfirmOptions;
  managerAddress: [PublicKey, number];
  provider: Provider;

  private constructor(
    programId: PublicKey,
    provider: Provider,
    opts?: ConfirmOptions
  ) {
    this.managerAddress = [PublicKey.default, 0];
    this.manager = {} as Manager;
    this.tokenData = {} as TokenData;
    this.connection = provider.connection;
    this.programId = programId;
    this.provider = provider;
    this.opts = opts;
    this.program = new Program<InceptProgram>(IDL, this.programId, provider);
  }
  public async initializeManager() {
    const managerPubkeyAndBump = await this.getManagerAddress();
    const usdiMint = anchor.web3.Keypair.generate();
    const liquidatedCometUsdiTokenAccount = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeManager(managerPubkeyAndBump[1], {
      accounts: {
        admin: this.provider.wallet.publicKey,
        manager: managerPubkeyAndBump[0],
        usdiMint: usdiMint.publicKey,
        liquidatedCometUsdiTokenAccount:
          liquidatedCometUsdiTokenAccount.publicKey,
        tokenData: tokenData.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      instructions: [
        // @ts-ignore
        await this.program.account.tokenData.createInstruction(
          tokenData,
          TOKEN_DATA_SIZE
        ),
      ],
      signers: [usdiMint, tokenData, liquidatedCometUsdiTokenAccount],
    });
    this.managerAddress = managerPubkeyAndBump;
    // @ts-ignore
    this.manager = (await this.program.account.manager.fetch(
      this.managerAddress[0]
    )) as Manager;
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
      .subscribe(this.manager.tokenData)
      .on("change", (state: TokenData) => {
        fn(state);
      });
  }

  public async getCollateral(collateralIndex: number) {
    const tokenData = (await this.getTokenData()) as TokenData;
    return tokenData[collateralIndex];
  }

  public async initializeUser() {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const managerAccount = await this.getManagerAccount();
    const { userPubkey, bump } = await this.getUserAddress();

    const cometPositionsAccount = anchor.web3.Keypair.generate();
    const mintPositionsAccount = anchor.web3.Keypair.generate();
    const liquidityPositionsAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeUser(managerBump, bump, {
      accounts: {
        user: this.provider.wallet.publicKey,
        manager: managerPubkey,
        userAccount: userPubkey,
        cometPositions: cometPositionsAccount.publicKey,
        mintPositions: mintPositionsAccount.publicKey,
        liquidityPositions: liquidityPositionsAccount.publicKey,
        usdiMint: managerAccount.usdiMint,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      instructions: [
        // @ts-ignore
        await this.program.account.cometPositions.createInstruction(
          cometPositionsAccount,
          COMET_POSITIONS_SIZE
        ),
        // @ts-ignore
        await this.program.account.mintPositions.createInstruction(
          mintPositionsAccount,
          MINT_POSITIONS_SIZE
        ),
        // @ts-ignore
        await this.program.account.liquidityPositions.createInstruction(
          liquidityPositionsAccount,
          LIQUIDITY_POSITIONS_SIZE
        ),
      ],
      signers: [
        cometPositionsAccount,
        mintPositionsAccount,
        liquidityPositionsAccount,
      ],
    });
  }

  public async addCollateral(
    admin: PublicKey,
    scale: number,
    stable: number,
    collateral_mint: PublicKey
  ) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    // const managerAccount = await this.getManagerAccount();
    const vaultAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.addCollateral(managerBump, scale, stable, {
      accounts: {
        admin: admin,
        manager: managerPubkey,
        tokenData: this.manager.tokenData,
        collateralMint: collateral_mint,
        vault: vaultAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      signers: [vaultAccount],
    });
  }

  public async initializePool(
    admin: PublicKey,
    stableCollateralRatio: number,
    cryptoCollateralRatio: number,
    oracle: PublicKey
  ) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const managerAccount = await this.getManagerAccount();
    const usdiTokenAccount = anchor.web3.Keypair.generate();
    const iassetMintAccount = anchor.web3.Keypair.generate();
    const iassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidationIassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidationUsdiTokenAccount = anchor.web3.Keypair.generate();
    const liquidityTokenMintAccount = anchor.web3.Keypair.generate();
    const cometLiquidityTokenAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializePool(
      managerBump,
      stableCollateralRatio,
      cryptoCollateralRatio,
      {
        accounts: {
          admin: admin,
          manager: managerPubkey,
          tokenData: managerAccount.tokenData,
          usdiMint: managerAccount.usdiMint,
          usdiTokenAccount: usdiTokenAccount.publicKey,
          iassetMint: iassetMintAccount.publicKey,
          iassetTokenAccount: iassetTokenAccount.publicKey,
          liquidationIassetTokenAccount:
            liquidationIassetTokenAccount.publicKey,
          liquidationUsdiTokenAccount: liquidationUsdiTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
          oracle: oracle,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        signers: [
          usdiTokenAccount,
          iassetMintAccount,
          iassetTokenAccount,
          liquidationIassetTokenAccount,
          liquidationUsdiTokenAccount,
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
    let iasset = (
      await this.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "confirmed"
      )
    ).value!.amount;
    let usdi = (
      await this.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "confirmed"
      )
    ).value!.amount;
    return [iasset, usdi];
  }

  public async getAssetInfo(poolIndex: number) {
    const tokenData = (await this.getTokenData()) as TokenData;
    return tokenData.pools[poolIndex].assetInfo as AssetInfo;
  }

  public async updatePrices(signers?: Array<Keypair>) {
    const updatePricesIx = await this.updatePricesInstruction();
    await this.provider.send(new Transaction().add(updatePricesIx), signers);
  }
  public async updatePricesInstruction() {
    const tokenData = await this.getTokenData();

    const priceFeeds = tokenData.pools
      .slice(0, Number(tokenData.numPools))
      .map((pool) => {
        return {
          pubkey: pool.assetInfo.priceFeedAddress,
          isWritable: false,
          isSigner: false,
        };
      });

    return (await this.program.instruction.updatePrices(
      this.managerAddress[1],
      {
        remainingAccounts: priceFeeds,
        accounts: {
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
        },
      }
    )) as TransactionInstruction;
  }

  public async getTokenData() {
    // @ts-ignore
    return (await this.program.account.tokenData.fetch(
      this.manager.tokenData
    )) as TokenData;
  }

  public async getLiquidityPositions() {
    // @ts-ignore
    return (await this.program.account.liquidityPositions.fetch(
      this.provider.wallet.publicKey
    )) as LiquidityPositions;
  }
  public async getLiquidityPosition(liquidityIndex: number) {
    return (await this.getLiquidityPositions()).liquidityPositions[
      liquidityIndex
    ];
  }

  public async getMintPositions() {
    const userAccountData = (await this.getUserAccount()) as User;
    // @ts-ignore
    return (await this.program.account.mintPositions.fetch(
      userAccountData.mintPositions
    )) as MintPositions;
  }
  public async getMintPosition(mintIndex: number) {
    return (await this.getMintPositions()).mintPositions[mintIndex];
  }

  public async getCometPositions(address?: PublicKey) {
    const userAccountData = (await this.getUserAccount(address)) as User;
    // @ts-ignore
    return (await this.program.account.cometPositions.fetch(
      userAccountData.cometPositions
    )) as CometPositions;
  }
  public async getCometPosition(cometIndex: number) {
    const cometPositions = (await this.getCometPositions()) as CometPositions;
    return cometPositions.cometPositions[cometIndex] as CometPosition;
  }

  public async getManagerAddress() {
    return await PublicKey.findProgramAddress(
      [Buffer.from("manager")],
      this.program.programId
    );
  }

  public async getManagerAccount() {
    // @ts-ignore
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
          tokenData: this.manager.tokenData,
          vault: tokenData.collaterals[collateralIndex].vault,
          usdiMint: this.manager.usdiMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async initializeMintPositions(
    iassetAmount: BN,
    collateralAmount: BN,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const initializeMintPositionsIx =
      await this.initializeMintPositionsInstruction(
        userCollateralTokenAccount,
        userIassetTokenAccount,
        iassetAmount,
        collateralAmount,
        poolIndex,
        collateralIndex
      );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(initializeMintPositionsIx),
      signers
    );
  }
  public async initializeMintPositionsInstruction(
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.initializeMintPosition(
      this.managerAddress[1],
      userAddress[1],
      iassetAmount,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          mintPositions: userAccount.mintPositions,
          vault: tokenData.collaterals[collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          oracle: tokenData.pools[poolIndex].assetInfo.priceFeedAddress,
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
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.addCollateralToMint(
      this.managerAddress[1],
      userAddress[1],
      collateralIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
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
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.withdrawCollateralFromMint(
      this.managerAddress[1],
      userAddress[1],
      collateralIndex,
      collateralAmount,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
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
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const payBackiAssetToMintIx = await this.payBackiAssetToMintInstruction(
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      collateralIndex
    );
    await this.provider.send(
      new Transaction().add(payBackiAssetToMintIx),
      signers
    );
  }
  public async payBackiAssetToMintInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.payBackMint(
      this.managerAddress[1],
      userAddress[1],
      collateralIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          mintPositions: userAccount.mintPositions,
          iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addiAssetToMint(
    iassetAmount: BN,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addiAssetToMintIx = await this.addiAssetToMintInstruction(
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      collateralIndex
    );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(addiAssetToMintIx),
      signers
    );
  }
  public async addiAssetToMintInstruction(
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.addIassetToMint(
      this.managerAddress[1],
      userAddress[1],
      collateralIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          mintPositions: userAccount.mintPositions,
          iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
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

    return (await this.program.instruction.initializeLiquidityPosition(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          liquidityPositions: userAccount.liquidityPositions,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userLiquidityTokenAccount: userLiquidityTokenAccount,
          ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
          ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
          liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
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
          tokenData: this.manager.tokenData,
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
    iassetAmount: BN,
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
      iassetAmount,
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
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount();

    let pool = tokenData.pools[poolIndex];

    return (await this.program.instruction.withdrawLiquidity(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
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
          tokenData: this.manager.tokenData,
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
          tokenData: this.manager.tokenData,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
          ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async initializeComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    usdiAmount: BN,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const initializeCometIx = await this.initializeCometInstruction(
      userCollateralTokenAccount,
      collateralAmount,
      usdiAmount,
      poolIndex,
      collateralIndex
    );
    await this.provider.send(new Transaction().add(initializeCometIx), signers);
  }
  public async initializeCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    usdiAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();

    return (await this.program.instruction.initializeComet(
      this.managerAddress[1],
      userAddress[1],
      poolIndex,
      collateralAmount,
      usdiAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
          userCollateralTokenAccount: userCollateralTokenAccount,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
          ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
          liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[poolIndex].cometLiquidityTokenAccount,
          vault: tokenData.collaterals[collateralIndex].vault,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addCollateralToComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const addCollateralToCometIx = await this.addCollateralToCometInstruction(
      userCollateralTokenAccount,
      collateralAmount,
      cometIndex
    );
    await this.provider.send(
      new Transaction().add(addCollateralToCometIx),
      signers
    );
  }
  public async addCollateralToCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let { userPubkey, bump } = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let cometPosition = await this.getCometPosition(cometIndex);

    return (await this.program.instruction.addCollateralToComet(
      this.managerAddress[1],
      bump,
      cometIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          cometPositions: userAccount.cometPositions,
          vault: tokenData.collaterals[cometPosition.collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawCollateralFromComet(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawCollateralFromCometIx =
      await this.withdrawCollateralFromCometInstruction(
        userCollateralTokenAccount,
        collateralAmount,
        cometIndex
      );
    await this.provider.send(
      new Transaction().add(withdrawCollateralFromCometIx),
      signers
    );
  }
  public async withdrawCollateralFromCometInstruction(
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let cometPosition = await this.getCometPosition(cometIndex);

    return (await this.program.instruction.withdrawCollateralFromComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      collateralAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          cometPositions: userAccount.cometPositions,
          vault: tokenData.collaterals[cometPosition.collateralIndex].vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async addLiquidityToComet(
    usdiAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawCollateralFromCometIx =
      await this.addLiquidityToCometInstruction(usdiAmount, cometIndex);
    await this.provider.send(
      new Transaction().add(withdrawCollateralFromCometIx),
      signers
    );
  }
  public async addLiquidityToCometInstruction(
    usdiAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let cometPosition = await this.getCometPosition(cometIndex);

    return (await this.program.instruction.addLiquidityToComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      usdiAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          liquidityTokenMint: tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[cometPosition.poolIndex].cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async subtractLiquidityFromComet(
    usdiAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawCollateralFromCometIx =
      await this.subtractLiquidityFromCometInstruction(usdiAmount, cometIndex);
    await this.provider.send(
      new Transaction().add(withdrawCollateralFromCometIx),
      signers
    );
  }
  public async subtractLiquidityFromCometInstruction(
    usdiAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let cometPosition = await this.getCometPosition(cometIndex);

    return (await this.program.instruction.subtractLiquidityFromComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      usdiAmount,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          liquidityTokenMint: tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[cometPosition.poolIndex].cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async closeComet(
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const closeCometIx = await this.closeCometInstruction(
      userCollateralTokenAccount,
      userIassetTokenAccount,
      userUsdiTokenAccount,
      cometIndex
    );
    await this.provider.send(new Transaction().add(closeCometIx), signers);
  }
  public async closeCometInstruction(
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let cometPosition = await this.getCometPosition(cometIndex);

    return (await this.program.instruction.closeComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          userCollateralTokenAccount: userCollateralTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userUsdiTokenAccount: userUsdiTokenAccount,
          cometPositions: userAccount.cometPositions,
          cometLiquidityTokenAccount:
            tokenData.pools[cometPosition.poolIndex].cometLiquidityTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
          vault: tokenData.collaterals[cometPosition.collateralIndex].vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async recenterComet(
    userIassetTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const recenterCometIx = await this.recenterCometInstruction(
      userIassetTokenAccount,
      cometIndex
    );
    await this.provider.send(new Transaction().add(recenterCometIx), signers);
  }
  public async recenterCometInstruction(
    userIassetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress();
    let userAccount = await this.getUserAccount();
    let cometPosition = await this.getCometPosition(cometIndex);

    return (await this.program.instruction.recenterComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo.iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex].liquidityTokenMint,
          vault: tokenData.collaterals[cometPosition.collateralIndex].vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  // Hackathon ONLY!
  public async hackathonMintUsdiInstruction(
    userUsdiTokenAccount: PublicKey,
    amount: number
  ) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();

    return this.program.instruction.mintUsdiHackathon(
      managerBump,
      new BN(amount),
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: managerPubkey,
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async fetchOrCreateAssociatedTokenAccount(mint: PublicKey) {
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

  public async liquidateComet(liquidateAccount: PublicKey, cometIndex: number) {
    const updatePricesIx = await this.updatePricesInstruction();
    const liquidateCometTx = await this.liquidateCometInstruction(
      liquidateAccount,
      cometIndex
    );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(liquidateCometTx)
    );
  }
  public async liquidateCometInstruction(
    liquidateAccount: PublicKey,
    cometIndex: number
  ) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const { userPubkey, bump } = await this.getUserAddress();
    const userAccount = await this.getUserAccount(liquidateAccount);
    const tokenData = await this.getTokenData();

    const cometPosition = await this.getCometPosition(cometIndex);
    const pool = tokenData.pools[cometPosition.poolIndex];
    const collateral = tokenData.collaterals[cometPosition.collateralIndex];

    const liquidatorCollateralTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(collateral.mint);

    const liquidatorUsdiTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(this.manager.usdiMint);

    const liquidatoriAssetTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

    return this.program.instruction.liquidateComet(
      managerBump,
      bump,
      cometIndex,
      {
        accounts: {
          liquidator: this.provider.wallet.publicKey,
          manager: managerPubkey,
          tokenData: this.manager.tokenData,
          userAccount: liquidateAccount,
          usdiMint: this.manager.usdiMint,
          iassetMint: pool.assetInfo.iassetMint,
          cometPositions: userAccount.cometPositions,
          vault: tokenData.collaterals[cometPosition.collateralIndex].vault,
          cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
          liquidatedCometUsdiTokenAccount: this.manager.liquidatedCometUsdi,
          liquidationIassetTokenAccount: pool.liquidationIassetTokenAccount,
          liquidationUsdiTokenAccount: this.manager.liquidatedCometUsdi,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidatorCollateralTokenAccount:
            liquidatorCollateralTokenAccount.address,
          liquidatorUsdiTokenAccount: liquidatorUsdiTokenAccount.address,
          liquidatorIassetTokenAccount: liquidatoriAssetTokenAccount.address,
          liquidityTokenMint: pool.liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async claimLiquidatedComet(cometIndex: number) {
    const claimLiquidatedCometTx = await this.claimLiquidatedCometInstruction(
      cometIndex
    );
    await this.provider.send(new Transaction().add(claimLiquidatedCometTx));
  }

  public async claimLiquidatedCometInstruction(cometIndex: number) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const { userPubkey, bump } = await this.getUserAddress();
    const userAccount = await this.getUserAccount();
    const tokenData = await this.getTokenData();

    const cometPosition = await this.getCometPosition(cometIndex);
    const pool = tokenData.pools[cometPosition.poolIndex];

    const userUsdiTokenAccount = await this.fetchOrCreateAssociatedTokenAccount(
      this.manager.usdiMint
    );
    const useriAssetTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

    return this.program.instruction.claimLiquidatedComet(
      managerBump,
      bump,
      cometIndex,
      {
        accounts: {
          user: this.provider.wallet.publicKey,
          manager: managerPubkey,
          tokenData: this.manager.tokenData,
          userAccount: userPubkey,
          cometPositions: userAccount.cometPositions,
          userIassetTokenAccount: useriAssetTokenAccount.address,
          userUsdiTokenAccount: userUsdiTokenAccount.address,
          liquidationIassetTokenAccount: pool.liquidationIassetTokenAccount,
          liquidationUsdiTokenAccount: this.manager.liquidatedCometUsdi,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
  }

  public async liquidateMintPosition(
    liquidateAccount: PublicKey,
    mintIndex: number
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const liquidateMintTx = await this.liquidateMintPositionInstruction(
      liquidateAccount,
      mintIndex
    );
    await this.provider.send(
      new Transaction().add(updatePricesIx).add(liquidateMintTx)
    );
  }

  public async liquidateMintPositionInstruction(
    liquidateAccount: PublicKey,
    mintIndex: number
  ) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const userAccount = await this.getUserAccount(liquidateAccount);
    const tokenData = await this.getTokenData();

    const mintPosition = await this.getMintPosition(mintIndex);
    const pool = tokenData.pools[mintPosition.poolIndex];
    const collateral = tokenData.collaterals[mintPosition.collateralIndex];

    const liquidatorCollateralTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(collateral.mint);
    const liquidatoriAssetTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

    return this.program.instruction.liquidateMintPosition(
      managerBump,
      mintIndex,
      {
        accounts: {
          liquidator: this.provider.wallet.publicKey,
          manager: managerPubkey,
          tokenData: this.manager.tokenData,
          userAccount: liquidateAccount,
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

  public async partialCometLiquidation(
    liquidateAccount: PublicKey,
    liquidateiAssetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let partialLiquidationTx = await this.partialCometLiquidationInstruction(
      liquidateAccount,
      liquidateiAssetTokenAccount,
      cometIndex
    );
    await this.provider.send(new Transaction().add(partialLiquidationTx));
  }

  public async partialCometLiquidationInstruction(
    liquidateAccount: PublicKey,
    liquidateiAssetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount(liquidateAccount);
    let cometPositions = await this.getCometPositions(liquidateAccount);
    let cometPosition = cometPositions.cometPositions[cometIndex];
    let pool = tokenData.pools[cometPosition.poolIndex];

    let liquidatorIassetTokenAccount =
      await this.fetchOrCreateAssociatedTokenAccount(pool.assetInfo.iassetMint);

    return (await this.program.instruction.partialCometLiquidation(
      this.managerAddress[1],
      cometIndex,
      {
        accounts: {
          liquidator: this.provider.wallet.publicKey,
          userAccount: liquidateAccount,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint: pool.assetInfo.iassetMint,
          userIassetTokenAccount: liquidateiAssetTokenAccount,
          liquidatorIassetTokenAccount: liquidatorIassetTokenAccount.address,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount: pool.usdiTokenAccount,
          ammIassetTokenAccount: pool.iassetTokenAccount,
          liquidityTokenMint: pool.liquidityTokenMint,
          vault: tokenData.collaterals[cometPosition.collateralIndex].vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }
}

export interface Manager {
  usdiMint: PublicKey;
  liquidatedCometUsdi: PublicKey;
  tokenData: PublicKey;
  // admin: PublicKey;
}

export interface User {
  authority: PublicKey;
  cometPositions: PublicKey;
  mintPositions: PublicKey;
  liquidityPositions: PublicKey;
}

export interface TokenData {
  manager: PublicKey;
  numPools: BN;
  numCollaterals: BN;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
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

export interface CometPositions {
  owner: PublicKey;
  numPositions: BN;
  cometPositions: Array<CometPosition>;
}

export interface CometPosition {
  authority: PublicKey;
  collateralAmount: Value;
  poolIndex: number;
  collateralIndex: number;
  borrowedUsdi: Value;
  borrowedIasset: Value;
  liquidityTokenValue: Value;
  lowerPriceRange: Value;
  upperPriceRange: Value;
  cometLiquidation: CometLiquidation;
}

export interface CometLiquidation {
  liquidated: number;
  excess_token_type_is_usdi: number;
  excess_token_amount: Value;
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
  lastUpdate: number;
  stableCollateralRatio: Value;
  cryptoCollateralRatio: Value;
}

export interface Pool {
  iassetTokenAccount: PublicKey;
  usdiTokenAccount: PublicKey;
  liquidityTokenMint: PublicKey;
  liquidationIassetTokenAccount: PublicKey;
  cometLiquidityTokenAccount: PublicKey;
  assetInfo: AssetInfo;
}

export interface Collateral {
  poolIndex: number;
  mint: PublicKey;
  vault: PublicKey;
  vaultUsdiSupply: Value;
  vaultMintSupply: Value;
  vaultCometSupply: Value;
  status: number;
}
