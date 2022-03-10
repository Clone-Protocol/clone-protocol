import * as anchor from "@project-serum/anchor";
import { BN, Program, Provider, Wallet } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Incept as InceptProgram, IDL } from "./idl/incept";
import { signAndSend, sleep } from "./utils";
import { Network, TEST_NET, DEV_NET, MAIN_NET } from "./network";
import {
  PublicKey,
  Connection,
  ConfirmOptions,
  TransactionInstruction,
  Transaction,
  Keypair,
} from "@solana/web3.js";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

const TOKEN_DATA_SIZE = 130616;
const COMET_POSITIONS_SIZE = 59208;
const MINT_POSITIONS_SIZE = 24528;
const LIQUIDITY_POSITIONS_SIZE = 16368;
const VAULT_SIZE = 100;

export class Incept {
  connection: Connection;
  network: Network;
  wallet: typeof Wallet;
  programId: PublicKey;
  program: Program<InceptProgram>;
  manager: Manager;
  tokenData: TokenData;
  opts?: ConfirmOptions;
  managerAddress: [PublicKey, number];
  provider: Provider

  private constructor(
    connection: Connection,
    network: Network,
    wallet: typeof Wallet,
    exchangeAuthority = PublicKey.default,
    programId = PublicKey.default,
    opts?: ConfirmOptions
  ) {
    this.managerAddress = [PublicKey.default, 0];
    this.manager = {} as Manager;
    this.tokenData = {} as TokenData;
    this.connection = connection;
    this.network = network;
    this.wallet = wallet;
    this.opts = opts;
    this.provider = new Provider(
      connection,
      wallet,
      opts || Provider.defaultOptions()
    );
    switch (network) {
      case Network.LOCAL:
        this.programId = programId;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          this.provider
        );
        break;
      case Network.TEST:
        this.programId = TEST_NET.exchange;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          this.provider
        );
        break;
      case Network.DEV:
        this.programId = DEV_NET.exchange;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          this.provider
        );
        break;
      case Network.MAIN:
        this.programId = MAIN_NET.exchange;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          this.provider
        );
        break;
      default:
        throw new Error("Not supported");
    }
  }
  public async initializeManager(admin: PublicKey) {
    const managerPubkeyAndBump = await this.getManagerAddress();
    const usdiMint = anchor.web3.Keypair.generate();
    const liquidatedCometUsdiTokenAccount = anchor.web3.Keypair.generate();
    const tokenData = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeManager(managerPubkeyAndBump[1], {
      accounts: {
        admin: admin,
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
    this.program.account.manager.subscribe(this.managerAddress[0]).on(
      "change",
      (state: Manager) => {
        fn(state);
      }
    );
  }

  public onTokenDataChange(fn: (state: TokenData) => void) {
    this.program.account.tokenData.subscribe(this.manager.tokenData).on(
      "change",
      (state: TokenData) => {
        fn(state);
      }
    );
  }

  public async getCollateral(collateralIndex: number) {
    const tokenData = await this.getTokenData() as TokenData;
    return tokenData[collateralIndex];
  }

  public async initializeUser(userWalletAddress: anchor.web3.PublicKey) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const managerAccount = await this.getManagerAccount();
    const { userPubkey, bump } = await this.getUserAddress(userWalletAddress);

    const cometPositionsAccount = anchor.web3.Keypair.generate();
    const mintPositionsAccount = anchor.web3.Keypair.generate();
    const liquidityPositionsAccount = anchor.web3.Keypair.generate();

    await this.program.rpc.initializeUser(managerBump, bump, {
      accounts: {
        user: userWalletAddress,
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

  public async addCollateral(admin, scale, stable, collateral_mint) {
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
      signers: [vaultAccount]
    });
  }

  public async initializePool(
    admin,
    stableCollateralRatio,
    cryptoCollateralRatio,
    oracle
  ) {
    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const managerAccount = await this.getManagerAccount();
    const usdiTokenAccount = anchor.web3.Keypair.generate();
    const iassetMintAccount = anchor.web3.Keypair.generate();
    const iassetTokenAccount = anchor.web3.Keypair.generate();
    const liquidationIassetTokenAccount = anchor.web3.Keypair.generate();
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
          liquidationIassetTokenAccount: liquidationIassetTokenAccount.publicKey,
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
          liquidityTokenMintAccount,
          cometLiquidityTokenAccount
        ]
      }
    );
  }

  public async getPool(poolIndex: number) {
    const tokenData = await this.getTokenData() as TokenData;
    return tokenData[poolIndex];
  }

  public async getPoolBalances(poolIndex: number) {
    let pool = await this.getPool(poolIndex);
    let iasset = (
      await this.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "confirmed"
      )
    ).value!.amount
    let usdi = (
      await this.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "confirmed"
      )
    ).value!.amount
    return [iasset, usdi]
  }

  public async getAssetInfo(poolIndex) {
    const tokenData = await this.getTokenData() as TokenData;
    return tokenData[poolIndex].assetInfo;
  }

  public async updatePrices(signers?: Array<Keypair>) {
    const updatePricesIx = await this.updatePricesInstruction();
    await signAndSend(
      new Transaction().add(updatePricesIx),
      signers,
      this.connection
    );
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

    return (await this.program.instruction.updatePrices(this.managerAddress[1], {
      remainingAccounts: priceFeeds,
      accounts: {
        manager: this.managerAddress[0],
        tokenData: this.manager.tokenData,
      },
    })) as TransactionInstruction;
  }

  public async getTokenData() {
    // @ts-ignore
    return await this.program.account.tokenData.fetch(
      this.manager.tokenData
    ) as TokenData;
  }

  public async getLiquidityPositions(userWalletAddress: PublicKey) {
    // @ts-ignore
    return await this.program.account.liquidityPositions.fetch(
      userWalletAddress
    ) as LiquidityPositions;
  }
  public async getLiquidityPosition(userWalletAddress: PublicKey, liquidityIndex: number) {
    return (await this.getLiquidityPositions(userWalletAddress)).liquidityPositions[liquidityIndex];
  }

  public async getMintPositions(userWalletAddress: PublicKey) {
      // @ts-ignore
      return await this.program.account.mintPositions.fetch(
        userWalletAddress
      ) as MintPositions;
  }
  public async getMintPosition(userWalletAddress: PublicKey, mintIndex: number) {
    return (await this.getMintPositions(userWalletAddress)).mintPositions[mintIndex];
  }

  public async getCometPositions(userWalletAddress: PublicKey) {
    const userAccountData = await this.getUserAccount(userWalletAddress) as User;
    // @ts-ignore
    return await this.program.account.cometPositions.fetch(
      userAccountData.cometPositions
    ) as CometPositions;
  }
  public async getCometPosition(userWalletAddress: PublicKey, cometIndex: number) {
    const cometPositions = await this.getCometPositions(userWalletAddress) as CometPositions;
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

  public async getUserAddress(userWalletAddress: PublicKey) {
    const [userPubkey, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("user"), userWalletAddress.toBuffer()],
      this.program.programId
    );
    return { userPubkey, bump };
  }

  public async getUserAccount(userWalletAddress: PublicKey) {
    const {userPubkey, bump} = await this.getUserAddress(userWalletAddress);
    return await this.program.account.user.fetch(
      userPubkey
    ) as User;
  }

  public async mintUsdi(
    amount: BN,
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const mintUsdiIx = await this.mintUsdiInstruction(
      amount,
      user,
      userUsdiTokenAccount,
      userCollateralTokenAccount,
      collateralIndex
    ) as TransactionInstruction;
    // TODO: Figure out sign and send.
    await signAndSend(
      new Transaction().add(mintUsdiIx),
      signers,
      this.connection
    );
  }

  public async mintUsdiInstruction(
    amount: BN,
    user: PublicKey,
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
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          vault: tokenData.collaterals[collateralIndex].vault,
          usdiMint: this.manager.usdiMint,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userCollateralTokenAccount: userCollateralTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      }
    )) as TransactionInstruction;
  }

  public async initializeMintPositions(
    iassetAmount: BN,
    collateralAmount: BN,
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const initializeMintPositionsIx =
      await this.initializeMintPositionsInstruction(
        user,
        userCollateralTokenAccount,
        userIassetTokenAccount,
        iassetAmount,
        collateralAmount,
        poolIndex,
        collateralIndex
      );
    await signAndSend(
      new Transaction().add(updatePricesIx).add(initializeMintPositionsIx),
      signers,
      this.connection
    );
  }
  public async initializeMintPositionsInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    collateralAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.initializeMintPosition(
      this.managerAddress[1],
      userAddress[1],
      iassetAmount,
      collateralAmount,
      {
        accounts: {
          user: user,
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
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const addCollateralToMintIx = await this.addCollateralToMintInstruction(
      user,
      userCollateralTokenAccount,
      collateralAmount,
      collateralIndex
    );
    await signAndSend(
      new Transaction().add(addCollateralToMintIx),
      signers,
      this.connection
    );
  }

  public async addCollateralToMintInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.addCollateralToMint(
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

  public async withdrawCollateralFromMint(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {

    const updatePricesIx = await this.updatePricesInstruction();
    const withdrawCollateralFromMintIx =
      await this.withdrawCollateralFromMintInstruction(
        user,
        userCollateralTokenAccount,
        collateralAmount,
        collateralIndex
      );
    await signAndSend(
      new Transaction().add(updatePricesIx).add(withdrawCollateralFromMintIx),
      signers,
      this.connection
    );
  }
  
  public async withdrawCollateralFromMintInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

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
    user: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const payBackiAssetToMintIx = await this.payBackiAssetToMintInstruction(
      user,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      collateralIndex
    );
    await signAndSend(
      new Transaction().add(payBackiAssetToMintIx),
      signers,
      this.connection
    );
  }
  public async payBackiAssetToMintInstruction(
    user: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.payBackMint(
      this.managerAddress[1],
      userAddress[1],
      collateralIndex,
      iassetAmount,
      {
        accounts: {
          user: user,
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
    collateralAmount: BN,
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const updatePricesIx = await this.updatePricesInstruction();
    const addiAssetToMintIx = await this.addiAssetToMintInstruction(
      user,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex,
      collateralIndex
    );
    await signAndSend(
      new Transaction().add(updatePricesIx).add(addiAssetToMintIx),
      signers,
      this.connection
    );
  }
  public async addiAssetToMintInstruction(
    user: PublicKey,
    userIassetTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.addIassetToMint(
      this.managerAddress[1],
      userAddress[1],
      collateralIndex,
      iassetAmount,
      {
        accounts: {
          user: user,
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
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const initializeLiquidityPositionIx =
      await this.initializeLiquidityPositionInstruction(
        user,
        userUsdiTokenAccount,
        userIassetTokenAccount,
        userLiquidityTokenAccount,
        iassetAmount,
        poolIndex
      );
    await signAndSend(
      new Transaction().add(initializeLiquidityPositionIx),
      signers,
      this.connection
    );
  }
  public async initializeLiquidityPositionInstruction(
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    poolIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.initializeLiquidityPosition(
      this.managerAddress[1],
      poolIndex,
      iassetAmount,
      {
        accounts: {
          user: user,
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
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const provideLiquidityIx = await this.provideLiquidityInstruction(
      user,
      userUsdiTokenAccount,
      userIassetTokenAccount,
      userLiquidityTokenAccount,
      iassetAmount,
      poolIndex
    );
    await signAndSend(
      new Transaction().add(provideLiquidityIx),
      signers,
      this.connection
    );
  }
  public async provideLiquidityInstruction(
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    liquidityPositionIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.provideLiquidity(
      this.managerAddress[1],
      liquidityPositionIndex,
      iassetAmount,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          liquidityPositions: userAccount.liquidityPositions,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userLiquidityTokenAccount: userLiquidityTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[
              this.getLiquidityPositions(user)[liquidityPositionIndex].poolIndex
            ].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[
              this.getLiquidityPositions(user)[liquidityPositionIndex].poolIndex
            ].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[
              this.getLiquidityPositions(user)[liquidityPositionIndex].poolIndex
            ].liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawLiquidity(
    iassetAmount: BN,
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawLiquidityIx = await this.withdrawLiquidityInstruction(
      user,
      userUsdiTokenAccount,
      userIassetTokenAccount,
      userLiquidityTokenAccount,
      iassetAmount,
      poolIndex
    );
    await signAndSend(
      new Transaction().add(withdrawLiquidityIx),
      signers,
      this.connection
    );
  }
  public async withdrawLiquidityInstruction(
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userLiquidityTokenAccount: PublicKey,
    iassetAmount: BN,
    liquidityPositionIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.withdrawLiquidity(
      this.managerAddress[1],
      liquidityPositionIndex,
      iassetAmount,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          liquidityPositions: userAccount.liquidityPositions,
          userUsdiTokenAccount: userUsdiTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userLiquidityTokenAccount: userLiquidityTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[
              this.getLiquidityPositions(user)[liquidityPositionIndex].poolIndex
            ].usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[
              this.getLiquidityPositions(user)[liquidityPositionIndex].poolIndex
            ].iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[
              this.getLiquidityPositions(user)[liquidityPositionIndex].poolIndex
            ].liquidityTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async buySynth(
    iassetAmount: BN,
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const buySynthIx = await this.buySynthInstruction(
      user,
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex
    );
    await signAndSend(
      new Transaction().add(buySynthIx),
      signers,
      this.connection
    );
  }
  public async buySynthInstruction(
    user: PublicKey,
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
          user: user,
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
    user: PublicKey,
    userUsdiTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    poolIndex: number,
    signers?: Array<Keypair>
  ) {
    const buySynthIx = await this.buySynthInstruction(
      user,
      userUsdiTokenAccount,
      userIassetTokenAccount,
      iassetAmount,
      poolIndex
    );
    await signAndSend(
      new Transaction().add(buySynthIx),
      signers,
      this.connection
    );
  }
  public async sellSynthInstruction(
    user: PublicKey,
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
          user: user,
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
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    usdiAmount: BN,
    poolIndex: number,
    collateralIndex: number,
    signers?: Array<Keypair>
  ) {
    const initializeCometIx = await this.initializeCometInstruction(
      user,
      userCollateralTokenAccount,
      collateralAmount,
      usdiAmount,
      poolIndex,
      collateralIndex
    );
    await signAndSend(
      new Transaction().add(initializeCometIx),
      signers,
      this.connection
    );
  }
  public async initializeCometInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    usdiAmount: BN,
    poolIndex: number,
    collateralIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.initializeComet(
      this.managerAddress[1],
      userAddress[1],
      poolIndex,
      collateralAmount,
      usdiAmount,
      {
        accounts: {
          user: user,
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
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const addCollateralToCometIx = await this.addCollateralToCometInstruction(
      user,
      userCollateralTokenAccount,
      collateralAmount,
      cometIndex
    );
    await signAndSend(
      new Transaction().add(addCollateralToCometIx),
      signers,
      this.connection
    );
  }
  public async addCollateralToCometInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let {userPubkey, bump} = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);
    let cometPosition = await this.getCometPosition(user, cometIndex);

    return (await this.program.instruction.addCollateralToComet(
      this.managerAddress[1],
      bump,
      cometIndex,
      collateralAmount,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          cometPositions: userAccount.cometPositions,
          vault:
            tokenData.collaterals[cometPosition.collateralIndex]
              .vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex]
              .liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async withdrawCollateralFromComet(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const withdrawCollateralFromCometIx =
      await this.withdrawCollateralFromCometInstruction(
        user,
        userCollateralTokenAccount,
        collateralAmount,
        cometIndex
      );
    await signAndSend(
      new Transaction().add(withdrawCollateralFromCometIx),
      signers,
      this.connection
    );
  }
  public async withdrawCollateralFromCometInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    collateralAmount: BN,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);
    let cometPosition = await this.getCometPosition(user, cometIndex);

    return (await this.program.instruction.withdrawCollateralFromComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      collateralAmount,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          cometPositions: userAccount.cometPositions,
          vault:
            tokenData.collaterals[cometPosition.collateralIndex]
              .vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex]
              .liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .cometLiquidityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async closeComet(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const closeCometIx = await this.closeCometInstruction(
      user,
      userCollateralTokenAccount,
      userIassetTokenAccount,
      userUsdiTokenAccount,
      cometIndex
    );
    await signAndSend(
      new Transaction().add(closeCometIx),
      signers,
      this.connection
    );
  }
  public async closeCometInstruction(
    user: PublicKey,
    userCollateralTokenAccount: PublicKey,
    userIassetTokenAccount: PublicKey,
    userUsdiTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);
    let cometPosition = await this.getCometPosition(user, cometIndex);

    return (await this.program.instruction.closeComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo
              .iassetMint,
          userCollateralTokenAccount: userCollateralTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userUsdiTokenAccount: userUsdiTokenAccount,
          cometPositions: userAccount.cometPositions,
          cometLiquidityTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .cometLiquidityTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex]
              .liquidityTokenMint,
          vault:
            tokenData.collaterals[cometPosition.collateralIndex]
              .vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  public async recenterComet(
    user: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number,
    signers?: Array<Keypair>
  ) {
    const recenterCometIx = await this.recenterCometInstruction(
      user,
      userIassetTokenAccount,
      cometIndex
    );
    await signAndSend(
      new Transaction().add(recenterCometIx),
      signers,
      this.connection
    );
  }
  public async recenterCometInstruction(
    user: PublicKey,
    userIassetTokenAccount: PublicKey,
    cometIndex: number
  ) {
    let tokenData = await this.getTokenData();
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);
    let cometPosition = await this.getCometPosition(user, cometIndex);

    return (await this.program.instruction.recenterComet(
      this.managerAddress[1],
      userAddress[1],
      cometIndex,
      {
        accounts: {
          user: user,
          manager: this.managerAddress[0],
          tokenData: this.manager.tokenData,
          usdiMint: this.manager.usdiMint,
          iassetMint:
            tokenData.pools[cometPosition.poolIndex].assetInfo
              .iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[cometPosition.poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[cometPosition.poolIndex]
              .liquidityTokenMint,
          vault:
            tokenData.collaterals[cometPosition.collateralIndex]
              .vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
  }

  // Hackathon ONLY!

  public async hackathonMintUsdiInstruction(userUsdiTokenAccount: PublicKey, amount: number) {

    const [managerPubkey, managerBump] = await this.getManagerAddress();
    const tokenData = await this.getTokenData();
  
    return (
      this.program.instruction.mintUsdiHackathon(
        managerBump,
        new BN(amount),
        {
          accounts: {
            user: this.provider.wallet.publicKey,
            manager: managerPubkey,
            tokenData: this.manager.tokenData,
            usdiMint: this.manager.usdiMint,
            userUsdiTokenAccount: userUsdiTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID
          }
        }
      )
    )
  }

  public async hackathonMintUsdi(userUsdiTokenAccount: PublicKey, amount: number) {

    const mintUsdiTx = await this.hackathonMintUsdiInstruction(
      userUsdiTokenAccount,
      amount
    );
    await signAndSend(
      new Transaction().add(mintUsdiTx),
      // @ts-ignore
      [this.provider.wallet.payer],
      this.connection
    );    
  }

  public async liquidateComet() {}
  public async liquidateCometInstruction() {}

  public async claimLiquidatedComet() {}
  public async claimLiquidatedCometInstruction() {}
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
