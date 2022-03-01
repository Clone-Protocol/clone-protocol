import * as anchor from "@project-serum/anchor";
import { BN, Program, Provider, Wallet } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Incept as InceptProgram, IDL } from "./idl/incept";
import { signAndSend, sleep } from "./utils";
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

const TOKEN_DATA_SIZE = 130608;
const COMET_POSITIONS_SIZE = 55128;
const MINT_POSITIONS_SIZE = 22488;
const LIQUIDITY_POSITIONS_SIZE = 16368;

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
    const provider = new Provider(
      connection,
      wallet,
      opts || Provider.defaultOptions()
    );
    switch (network) {
      case Network.LOCAL:
        this.programId = programId;
        this.exchangeAuthority = exchangeAuthority;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          provider
        );
        break;
      case Network.TEST:
        this.programId = TEST_NET.exchange;
        this.exchangeAuthority = TEST_NET.exchangeAuthority;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          provider
        );
        break;
      case Network.DEV:
        this.programId = DEV_NET.exchange;
        this.exchangeAuthority = DEV_NET.exchangeAuthority;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          provider
        );
        break;
      case Network.MAIN:
        this.programId = MAIN_NET.exchange;
        this.exchangeAuthority = MAIN_NET.exchangeAuthority;
        this.program = new Program<InceptProgram>(
          IDL,
          this.programId,
          provider
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
        await this.program.account.TokenData.createInstruction(
          tokenData,
          TOKEN_DATA_SIZE
        ),
      ],
      signers: [usdiMint, tokenData, liquidatedCometUsdiTokenAccount],
    });
    this.managerAddress = managerPubkeyAndBump;
    this.manager = (await this.program.account.Manager.fetch(
      this.managerAddress[0]
    )) as Manager;
  }

  public onManagerAccountChange(fn: (state: Manager) => void) {
    this.program.account.Manager.subscribe(this.managerAddress[0]).on(
      "change",
      (state: Manager) => {
        fn(state);
      }
    );
  }

  public onTokenDataChange(fn: (state: TokenData) => void) {
    this.program.account.TokenData.subscribe(this.manager.tokenData).on(
      "change",
      (state: TokenData) => {
        fn(state);
      }
    );
  }

  public async initializeUser(userWalletAddress) {}

  public async addCollateral(admin) {}

  public async addPool(admin) {}

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
      .filter(
        (pool) => !pool.assetInfo.priceFeedAddress.equals(PublicKey.default)
      )
      .map((pool) => {
        return {
          pubkey: pool.assetInfo.priceFeedAddress,
          isWritable: false,
          isSigner: false,
        };
      });
    return (await this.program.instruction.updatePrices({
      remainingAccounts: priceFeeds,
      accounts: {
        manager: this.managerAddress[0],
        tokenData: this.manager.tokenData,
      },
    })) as TransactionInstruction;
  }

  public async getTokenData() {
    return {} as TokenData;
  }

  public async getManagerAddress() {
    return await PublicKey.findProgramAddress(
      [Buffer.from("manager")],
      this.program.programId
    );
  }

  public async getManagerAccount() {
    return (await this.program.account.Manager.fetch(
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
    return (await this.program.account.Manager.fetch(
      this.getUserAddress(userWalletAddress)[0]
    )) as User;
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
    );
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
        },
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
    const withdrawCollateralFromMintIx =
      await this.withdrawCollateralFromMintInstruction(
        user,
        userCollateralTokenAccount,
        collateralAmount,
        collateralIndex
      );
    await signAndSend(
      new Transaction().add(withdrawCollateralFromMintIx),
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
    let userAddress = await this.getUserAddress(user);
    let userAccount = await this.getUserAccount(user);

    return (await this.program.instruction.addCollateralToComet(
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
            tokenData.collaterals[this.getCometPositions(user).collateralIndex]
              .vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
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
            tokenData.collaterals[this.getCometPositions(user).collateralIndex]
              .vault,
          userCollateralTokenAccount: userCollateralTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .liquidityTokenMint,
          cometLiquidityTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
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
            tokenData.pools[this.getCometPositions().poolIndex].assetInfo
              .iassetMint,
          userCollateralTokenAccount: userCollateralTokenAccount,
          userIassetTokenAccount: userIassetTokenAccount,
          userUsdiTokenAccount: userUsdiTokenAccount,
          cometPositions: userAccount.cometPositions,
          cometLiquidityTokenAccount:
            tokenData.pools[this.getCometPositions().poolIndex]
              .cometLiquidityTokenAccount,
          ammUsdiTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .liquidityTokenMint,
          vault:
            tokenData.collaterals[this.getCometPositions(user).collateralIndex]
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
            tokenData.pools[this.getCometPositions().poolIndex].assetInfo
              .iassetMint,
          userIassetTokenAccount: userIassetTokenAccount,
          cometPositions: userAccount.cometPositions,
          ammUsdiTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .usdiTokenAccount,
          ammIassetTokenAccount:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .iassetTokenAccount,
          liquidityTokenMint:
            tokenData.pools[this.getCometPositions(user).poolIndex]
              .liquidityTokenMint,
          vault:
            tokenData.collaterals[this.getCometPositions(user).collateralIndex]
              .vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )) as TransactionInstruction;
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
  numPools: number;
  numCollaterals: number;
  pools: Array<Pool>;
  collaterals: Array<Collateral>;
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
  lastUpdate: BN;
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
