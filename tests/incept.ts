import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { Store } from "../sdk/src/idl/store";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";
import { InceptCometManager } from "../sdk/src/idl/incept_comet_manager";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import {
  DEVNET_TOKEN_SCALE,
  InceptClient,
  toDevnetScale,
} from "../sdk/src/incept";
import {
  createPriceFeed,
  setPrice,
  getFeedData,
  ChainLinkOracle,
} from "../sdk/src/oracle";
import { calculateExecutionThreshold, sleep } from "../sdk/src/utils";
import { Decimal, getMantissa, toNumber } from "../sdk/src/decimal";
import {
  convertToRawDecimal,
  getOrCreateAssociatedTokenAccount,
} from "./utils";
import {
  calculateEditCometSinglePoolWithUsdiBorrowed,
  getSinglePoolHealthScore,
  getHealthScore,
  getEffectiveUSDCollateralValue,
  calculateCometRecenterSinglePool,
  calculateCometRecenterMultiPool,
  getILD,
} from "../sdk/src/healthscore";
// import { Incept as InceptInfo } from "../sdk/src/interfaces";
import { ManagerInfo, Subscriber } from "../sdk/src/comet_manager";

describe("incept", async () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  let inceptProgram = anchor.workspace.Incept as Program<Incept>;
  let pythProgram = anchor.workspace.Pyth as Program<Pyth>;
  let walletPubkey = inceptProgram.provider.publicKey!;
  let storeProgram = anchor.workspace.Store as Program<Store>;
  let jupiterProgram = anchor.workspace
    .JupiterAggMock as Program<JupiterAggMock>;

  let cometManagerProgram = anchor.workspace
    .InceptCometManager as Program<InceptCometManager>;
  let chainlink;

  const mockUSDCMint = anchor.web3.Keypair.generate();
  const treasuryAddress = anchor.web3.Keypair.generate();
  let treasuryUsdiTokenAccount;
  let treasuryIassetTokenAccount;

  const healthScoreCoefficient = 1.059;
  const ilHealthScoreCoefficient = 128.288;
  const ilHealthScoreCutoff = 20;
  const ilLiquidationRewardPct = 5;
  const maxHealthLiquidation = 20;
  const liquidatorFee = 500; // in bps
  const poolTradingFee = 200;
  const treasuryTradingFee = 100;
  const collateralFullLiquidationThreshold = 25;

  let priceFeed;
  let mockUSDCTokenAccountInfo;
  let usdiTokenAccountInfo;
  let iassetTokenAccountInfo;
  let liquidityTokenAccountInfo;
  let inceptClient = new InceptClient(inceptProgram.programId, provider);

  const mockAssetMint = anchor.web3.Keypair.generate();
  let [jupiterAddress, jupiterNonce] = await PublicKey.findProgramAddress(
    [anchor.utils.bytes.utf8.encode("jupiter")],
    jupiterProgram.programId
  );

  it("mock jupiter agg initialized + mock usdc initialized + mock asset initialized!", async () => {
    await jupiterProgram.methods
      .initialize()
      .accounts({
        admin: jupiterProgram.provider.publicKey!,
        jupiterAccount: jupiterAddress,
        usdcMint: mockUSDCMint.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([mockUSDCMint])
      .rpc();
  });

  // it("mock usdc initialized!", async () => {
  //   await mockUSDCProgram.rpc.initialize(mockUSDCAccount[1], {
  //     accounts: {
  //       admin: walletPubkey,
  //       mockUsdcMint: mockUSDCMint.publicKey,
  //       mockUsdcAccount: mockUSDCAccount[0],
  //       rent: RENT_PUBKEY,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SYSTEM_PROGRAM_ID,
  //     },
  //     signers: [mockUSDCMint],
  //   });
  // });

  it("manager initialized!", async () => {
    await inceptClient.initializeIncept(
      storeProgram.programId,
      ilHealthScoreCutoff,
      ilLiquidationRewardPct,
      maxHealthLiquidation,
      liquidatorFee,
      treasuryAddress.publicKey
    );
  });

  it("user initialized!", async () => {
    await inceptClient.initializeUser();

    let userAccountData = await inceptClient.getUserAccount();

    assert(
      !userAccountData.authority.equals(anchor.web3.PublicKey.default),
      "check authority address"
    );
    assert(
      userAccountData.singlePoolComets.equals(anchor.web3.PublicKey.default),
      "check single pool comets address"
    );
    assert(
      userAccountData.borrowPositions.equals(anchor.web3.PublicKey.default),
      "check mint position address"
    );
    assert(
      userAccountData.comet.equals(anchor.web3.PublicKey.default),
      "check comet address"
    );
  });

  it("change feed price + mock asset created", async () => {
    let price = 10;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    priceFeed = await createPriceFeed(pythProgram, price, expo, conf);
    let currentPrice = (await getFeedData(pythProgram, priceFeed)).aggregate
      .price;
    assert.equal(currentPrice, price, "check initial price");

    price = 5;
    await setPrice(pythProgram, price, priceFeed);
    let updatedPrice = (await getFeedData(pythProgram, priceFeed)).aggregate
      .price;
    assert.equal(updatedPrice, price, "check updated price");

    chainlink = new ChainLinkOracle(storeProgram);

    await chainlink.createChainlinkFeed(1, 2);

    await chainlink.submitAnswer(new BN(1649943158), new BN(500000000));

    await sleep(200);

    await jupiterProgram.methods
      .createAsset(priceFeed)
      .accounts({
        payer: jupiterProgram.provider.publicKey!,
        assetMint: mockAssetMint.publicKey,
        jupiterAccount: jupiterAddress,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([mockAssetMint])
      .rpc();

    // let r = await chainlink.fetchAnswer();

    // console.log(r);
  });

  it("mock usdc added as a collateral!", async () => {
    await inceptClient.addCollateral(
      walletPubkey,
      7,
      1,
      mockUSDCMint.publicKey
    );
    await sleep(200);
  });

  it("pools initialized!", async () => {
    const jupiterData = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await inceptClient.initializePool(
      walletPubkey,
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      priceFeed,
      chainlink.priceFeedPubkey(),
      ilHealthScoreCoefficient,
      healthScoreCoefficient,
      500,
      10,
      jupiterData.assetMints[0]
    );

    await inceptProgram.methods
      .removePool(0, false)
      .accounts({
        admin: inceptClient.provider.publicKey!,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    await inceptClient.initializePool(
      walletPubkey,
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      priceFeed,
      chainlink.priceFeedPubkey(),
      ilHealthScoreCoefficient,
      healthScoreCoefficient,
      500,
      10,
      jupiterData.assetMints[0]
    );

    await sleep(400);
    let tokenData = await inceptClient.getTokenData();
    assert.equal(tokenData.numPools.toNumber(), 1);
  });

  it("non-stable mock asset added as a collateral!", async () => {
    await inceptClient.addCollateral(
      walletPubkey,
      8,
      0,
      mockAssetMint.publicKey,
      200,
      priceFeed,
      chainlink.priceFeedPubkey()
    );

    let tokenData = await inceptClient.getTokenData();
    assert.equal(tokenData.collaterals[2].stable.toNumber(), 0);
  });

  it("token data initialization check", async () => {
    const tokenData = await inceptClient.getTokenData();

    assert(
      tokenData.incept.equals(inceptClient.inceptAddress[0]),
      "wrong manager!"
    );
    assert.equal(tokenData.numPools.toNumber(), 1, "num pools incorrect");
    assert.equal(
      tokenData.numCollaterals.toNumber(),
      3,
      "num collaterals incorrect"
    );

    const first_pool = tokenData.pools[0];
    assert(
      !first_pool.iassetTokenAccount.equals(anchor.web3.PublicKey.default),
      "check iassetTokenAccount"
    );
    assert(
      !first_pool.usdiTokenAccount.equals(anchor.web3.PublicKey.default),
      "check usdiTokenAccount"
    );
    assert(
      !first_pool.liquidityTokenMint.equals(anchor.web3.PublicKey.default),
      "check liquidityTokenMint"
    );
    assert(
      !first_pool.underlyingAssetTokenAccount.equals(
        anchor.web3.PublicKey.default
      ),
      "check iassetTokenAccount"
    );
    assert(
      !first_pool.cometLiquidityTokenAccount.equals(
        anchor.web3.PublicKey.default
      ),
      "check iassetTokenAccount"
    );

    const assetInfo = first_pool.assetInfo;

    assert(
      assetInfo.priceFeedAddresses[0].equals(priceFeed),
      "check price feed"
    );

    assert.equal(
      toNumber(assetInfo.stableCollateralRatio),
      1.5,
      "stable collateral ratio incorrect"
    );
    assert.equal(
      toNumber(assetInfo.cryptoCollateralRatio),
      2,
      "crypto collateral ratio incorrect"
    );

    const first_collateral = tokenData.collaterals[1];
    assert(
      !first_collateral.mint.equals(anchor.web3.PublicKey.default),
      "check mint address"
    );
    assert(!first_collateral.vault.equals(anchor.web3.PublicKey.default)),
      "check vault address";
  });

  it("price updated!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];
    await inceptClient.updatePrices(undefined, signers);
    await sleep(200);
  });

  it("mock usdc minted!", async () => {
    const usdcMintAmount = new BN("10000000000000000000");
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    await jupiterProgram.methods
      .mintUsdc(jupiterNonce, usdcMintAmount)
      .accounts({
        usdcMint: mockUSDCMint.publicKey,
        usdcTokenAccount: mockUSDCTokenAccountInfo.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      1000000000000,
      "check USDC amount"
    );
  });

  it("usdi minted!", async () => {
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.mintUsdi(
      1000000,
      usdiTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address,
      1,
      signers
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      1000000,
      "check usdi token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999999000000,
      "check USDC amount"
    );

    const tokenData = await inceptClient.getTokenData();

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 1000000, "check usdc vault amount");
  });

  it("mint mock asset", async () => {
    let assetMintAmount = 1000;

    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        inceptClient.provider,
        mockAssetMint.publicKey
      );

    await jupiterProgram.methods
      .mintAsset(jupiterNonce, 0, new BN(assetMintAmount * 100000000))
      .accounts({
        assetMint: mockAssetMint.publicKey,
        assetTokenAccount: mockAssetAssociatedTokenAddress.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockAssetAssociatedTokenAddress = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockAssetMint.publicKey
    );

    assert.equal(
      Number(mockAssetAssociatedTokenAddress.amount) / 100000000,
      assetMintAmount
    );
  });

  it("iasset minted!", async () => {
    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[0];

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    const { userPubkey, bump } = await inceptClient.getUserAddress();

    const borrowAccountKeypair = anchor.web3.Keypair.generate();

    await inceptClient.program.methods
      .initializeBorrowPositions()
      .accounts({
        user: inceptClient.provider.publicKey!,
        userAccount: userPubkey,
        borrowPositions: borrowAccountKeypair.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .preInstructions([
        await inceptClient.program.account.borrowPositions.createInstruction(
          borrowAccountKeypair
        ),
      ])
      .signers([borrowAccountKeypair])
      .rpc();

    await sleep(400);

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.initializeBorrowPosition(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      0,
      1,
      signers
    );

    await sleep(200);

    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[0];

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999979000000,
      "check USDC amount"
    );

    let vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 21000000, "check usdc vault amount");

    const mintPosition = (await inceptClient.getBorrowPositions())
      .borrowPositions[0];

    assert.equal(
      toNumber(mintPosition.borrowedIasset),
      200000,
      "stored minted amount"
    );
    assert.equal(
      toNumber(mintPosition.collateralAmount),
      20000000,
      "stored minted amount"
    );
    assert.equal(
      toNumber(pool.suppliedMintCollateralAmount),
      20000000,
      "check supplied collateral amount!"
    );
    assert.equal(
      toNumber(pool.totalMintedAmount),
      200000,
      "check supplied collateral amount!"
    );
  });

  it("full withdraw and close mint position!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];
    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[0];

    await inceptClient.closeBorrowPosition(
      iassetTokenAccountInfo.address,
      0,
      mockUSDCTokenAccountInfo.address,
      signers
    );

    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[0];

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      0,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999999000000,
      "check USDC amount"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );

    assert.equal(vault.value!.uiAmount, 1000000, "check usdc vault amount");

    assert.equal(
      toNumber(pool.suppliedMintCollateralAmount),
      0,
      "check supplied collateral amount!"
    );
    assert.equal(
      toNumber(pool.totalMintedAmount),
      0,
      "check supplied collateral amount!"
    );

    // Recreate original position.
    await inceptClient.initializeBorrowPosition(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      0,
      1,
      signers
    );
  });

  it("mint collateral added!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    await inceptClient.addCollateralToBorrow(
      0,
      mockUSDCTokenAccountInfo.address,
      new BN(1000000000),
      signers
    );

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];

    await sleep(200);

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999900,
      "check USDC amount"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 21000100, "check usdc vault amount");

    assert.equal(
      toNumber(pool.suppliedMintCollateralAmount),
      20000100,
      "check supplied collateral amount!"
    );
  });

  it("mint collateral removed!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    await inceptClient.withdrawCollateralFromBorrow(
      mockUSDCTokenAccountInfo.address,
      0,
      new BN(1000000000),
      signers
    );

    await sleep(200);
    const tokenData = await inceptClient.getTokenData();

    const pool = tokenData.pools[0];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999979000000,
      "check USDC amount"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 21000000, "check usdc vault amount");
    assert.equal(
      toNumber(pool.suppliedMintCollateralAmount),
      20000000,
      "check supplied collateral amount!"
    );
  });

  it("iasset burned!", async () => {
    const tokenData = await inceptClient.getTokenData();

    const pool = tokenData.pools[0];
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    let userAccountData = await inceptClient.getUserAccount();
    let userAddress = await inceptClient.getUserAddress();
    let assetInfo = tokenData.pools[0].assetInfo;

    await inceptProgram.methods
      .subtractIassetFromBorrow(0, new BN(5000000))
      .accounts({
        user: walletPubkey,
        userAccount: userAddress.userPubkey,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
        userIassetTokenAccount: iassetTokenAccountInfo.address,
        borrowPositions: userAccountData.borrowPositions,
        iassetMint: assetInfo.iassetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      199999.95,
      "check user iasset balance."
    );
  });

  it("iasset reminted!", async () => {
    const tokenData = await inceptClient.getTokenData();

    const pool = tokenData.pools[0];
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    await inceptClient.addIassetToBorrow(
      iassetTokenAccountInfo.address,
      new BN(5000000),
      0,
      []
    );

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check user iasset balance"
    );
  });

  it("liquidity position initialized!", async () => {
    const tokenData = await inceptClient.getTokenData();

    const pool = tokenData.pools[0];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    await inceptClient.provideUnconcentratedLiquidity(
      toDevnetScale(100000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      0
    );

    await sleep(400);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      500000,
      "check usdi"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      100000,
      "check iasset"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 100000000,
      5000000,
      "check liquidity tokens"
    );

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );
    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      500000,
      "check usdi account balance"
    );

    const iassetAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );
    assert.equal(
      iassetAccountBalance.value!.uiAmount,
      100000,
      "check iasset account balance"
    );
  });

  it("liquidity provided!", async () => {
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    let pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    await inceptClient.provideUnconcentratedLiquidity(
      toDevnetScale(1),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      499995,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      99999,
      "check user iAsset balance"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 100000000,
      5000049.9995,
      "check liquidity token balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      500005,
      "check USDi pool balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      100001,
      "check iAsset pool balance"
    );
  });

  it("liquidity withdrawn!", async () => {
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    await inceptClient.withdrawUnconcentratedLiquidity(
      new BN(45453545454500),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      545448.54545905,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      109089.70909181,
      "check user iAsset balance"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 100000000,
      4545514.544955,
      "check user liquidity token balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      454551.45454095,
      "check pool usdi balance."
    );

    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      90910.29090819,
      "check pool iAsset balance."
    );
  });

  it("iasset bought!", async () => {
    let tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];
    const purchaseAmount = 10000;

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    const executionEst = calculateExecutionThreshold(
      purchaseAmount,
      true,
      pool,
      0.0001
    );
    const treasuryIassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.iassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryUsdiAssociatedTokenAddress = await getAssociatedTokenAddress(
      inceptClient.incept!.usdiMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    await inceptClient.provider.sendAndConfirm!(
      new Transaction()
        .add(
          await createAssociatedTokenAccountInstruction(
            inceptClient.provider.publicKey!,
            treasuryIassetAssociatedTokenAddress,
            treasuryAddress.publicKey,
            pool.assetInfo.iassetMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
        .add(
          await createAssociatedTokenAccountInstruction(
            inceptClient.provider.publicKey!,
            treasuryUsdiAssociatedTokenAddress,
            treasuryAddress.publicKey,
            inceptClient.incept!.usdiMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
    );
    treasuryIassetTokenAccount = await getAccount(
      inceptClient.provider.connection,
      treasuryIassetAssociatedTokenAddress,
      "recent"
    );
    treasuryUsdiTokenAccount = await getAccount(
      inceptClient.provider.connection,
      treasuryUsdiAssociatedTokenAddress,
      "recent"
    );
    await sleep(400);

    await inceptClient.buyIasset(
      toDevnetScale(purchaseAmount),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      487309.10873496,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      119089.70909181,
      "check user iAsset balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      512690.89126504,
      "check pool usdi balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      80807.19812468,
      "check pool iAsset balance"
    );

    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            treasuryIassetTokenAccount.address,
            "recent"
          )
        ).value!.uiAmount
      ),
      103.09278351,
      "check treasury iAsset balance"
    );
  });

  it("iasset sold!", async () => {
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    let executionEst = calculateExecutionThreshold(10000, false, pool, 0.0001);

    await inceptClient.sellIasset(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      new BN(executionEst.usdiThresholdAmount),
      treasuryUsdiTokenAccount.address
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      542074.60913552,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      109089.70909181,
      "check user iAsset balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      457360.79807685,
      "check pool usdi balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      90807.19812468,
      "check pool iAsset balance"
    );
  });

  it("single pool comet initialized!", async () => {
    await inceptClient.initializeSinglePoolComet(0, 0);

    await sleep(200);

    const singlePoolComets = await inceptClient.getSinglePoolComets();

    assert.equal(
      Number(singlePoolComets.numPositions),
      1,
      "ensure comet position was initialized"
    );
  });

  it("single pool comet collateral added!", async () => {
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    await inceptClient.mintUsdi(
      25,
      usdiTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address,
      1,
      []
    );
    await inceptClient.addCollateralToSinglePoolComet(
      usdiTokenAccountInfo.address,
      new BN(2500000000),
      0
    );
    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[1];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    assert.closeTo(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999979000000,
      1,
      "check user USDC"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(vault.value!.uiAmount, 21000000.00025, "check vault balance");
  });

  it("single pool comet collateral withdrawn!", async () => {
    let comet = await inceptClient.getSinglePoolComets();
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    let tokenData = await inceptClient.getTokenData();

    // Estimate using edit.
    const estimation = calculateEditCometSinglePoolWithUsdiBorrowed(
      tokenData,
      comet,
      0,
      -5,
      0
    );

    await inceptClient.withdrawCollateralFromSinglePoolComet(
      usdiTokenAccountInfo.address,
      new BN(50000000),
      0
    );

    const health = await getSinglePoolHealthScore(0, tokenData, comet);

    assert.closeTo(estimation.healthScore, health.healthScore, 0.01);

    await sleep(200);

    tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[1];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    assert.equal(
      Number(usdiTokenAccountInfo.amount),
      54207510913552,
      "check user USDI"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(vault.value!.uiAmount, 21000000.00025, "check vault balance");
  });

  it("single pool comet liquidity added!", async () => {
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    await inceptClient.addLiquidityToSinglePoolComet(new BN(51000000000), 0);

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      457870.79807685,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      90908.45663052,
      "check iasset pool balance"
    );
  });

  it("single pool comet liquidity subtracted!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    const comet = await inceptClient.getSinglePoolComets();
    const position = comet.positions[0];

    // // Estimate using edit.
    // const estimation =
    //   await inceptClient.calculateEditCometSinglePoolWithUsdiBorrowed(
    //     0,
    //     0,
    //     -10
    //   );

    // const estimationWithLowerPrice =
    //   await inceptClient.calculateEditCometSinglePoolWithRange(
    //     0,
    //     0,
    //     estimation.lowerPrice,
    //     true
    //   );

    // assert.closeTo(
    //   positionBorrowedUsdi - 10,
    //   estimationWithLowerPrice.usdiPosition,
    //   1e-3
    // );

    // const estimationWithUpperPrice =
    //   await inceptClient.calculateEditCometSinglePoolWithRange(
    //     0,
    //     0,
    //     estimation.upperPrice,
    //     false
    //   );

    // assert.closeTo(
    //   positionBorrowedUsdi - 10,
    //   estimationWithUpperPrice.usdiPosition,
    //   1e-3
    // );

    await inceptClient.withdrawLiquidityFromSinglePoolComet(
      new BN(10000000000),
      0
    );
    await sleep(200);

    // const healthScore = await inceptClient.getSinglePoolHealthScore(0);
    // assert.closeTo(estimation.healthScore, healthScore.healthScore, 0.1);

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      457860.73627211,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      90906.45889853,
      "check iasset pool balance"
    );
  });

  it("iasset bought!", async () => {
    let poolIndex = 0;
    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    const executionEst = calculateExecutionThreshold(10000, true, pool, 0.0001);

    await inceptClient.buyIasset(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      483509.61411564,
      "check user usdi balance."
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      119089.70909181,
      "check user iAsset balance."
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      516426.23129199,
      "check pool usdi"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      80803.36611502,
      "check pool iAsset"
    );
  });

  it("single pool comet recentered!", async () => {
    let poolIndex = 0;
    let tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];
    const collateral = tokenData.collaterals[1];
    let comet = await inceptClient.getSinglePoolComets();

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    const info = getSinglePoolHealthScore(0, tokenData, comet);

    const recenterEstimation = calculateCometRecenterSinglePool(
      0,
      tokenData,
      comet
    );

    await inceptClient.recenterSinglePoolComet(0);

    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getSinglePoolComets();

    const info2 = getSinglePoolHealthScore(0, tokenData, comet);

    assert.closeTo(info2.healthScore, recenterEstimation.healthScore, 0.02);

    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            collateral.vault,
            "recent"
          )
        ).value!.uiAmount
      ),
      21000000.00025,
      "check usdc collateral vault"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      516496.82238775,
      "check pool usdi"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      80792.32248821,
      "check pool iAsset"
    );
  });

  it("single pool comet extra tests!", async () => {
    // Increase pool price
    let tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool0 = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool0.assetInfo.iassetMint
    );
    // Create new single pool w/ USDi
    await inceptClient.initializeSinglePoolComet(0, 0);
    await inceptClient.addCollateralToSinglePoolComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(100),
      1
    );
    await inceptClient.addLiquidityToSinglePoolComet(toDevnetScale(200), 1);
    tokenData = await inceptClient.getTokenData();
    const pool1 = tokenData.pools[poolIndex];
    let executionEst = calculateExecutionThreshold(10000, true, pool1, 0.0001);
    await inceptClient.buyIasset(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
    await inceptClient.recenterSinglePoolComet(1);
    await inceptClient.withdrawLiquidityFromSinglePoolComet(
      toDevnetScale(10),
      1
    );
    tokenData = await inceptClient.getTokenData();
    const pool2 = tokenData.pools[poolIndex];

    executionEst = calculateExecutionThreshold(15000, false, pool2, 0.0001);

    // Decrease pool price
    await inceptClient.sellIasset(
      new BN(1500000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryUsdiTokenAccount.address
    );

    let singlePoolComet = (await inceptClient.getSinglePoolComets())
      .positions[1];
    tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[singlePoolComet.poolIndex];
    let L =
      toNumber(singlePoolComet.liquidityTokenValue) /
      toNumber(pool.liquidityTokenSupply);

    await inceptClient.recenterSinglePoolComet(1);
    singlePoolComet = (await inceptClient.getSinglePoolComets()).positions[1];
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[singlePoolComet.poolIndex];
    L =
      toNumber(singlePoolComet.liquidityTokenValue) /
      toNumber(pool.liquidityTokenSupply);

    // Need to withdraw all.
    await inceptClient.withdrawLiquidityFromSinglePoolComet(
      toDevnetScale(10 * toNumber(singlePoolComet.liquidityTokenValue)),
      1
    );

    //await inceptClient.withdrawLiquidityAndPaySinglePoolCometILD(1);
    await inceptClient.withdrawCollateralAndCloseSinglePoolComet(
      usdiTokenAccountInfo.address,
      1
    );

    // Need to buy to get back to original price
    tokenData = await inceptClient.getTokenData();
    const pool3 = tokenData.pools[poolIndex];

    const prevPrice = toNumber(pool1.usdiAmount) / toNumber(pool1.iassetAmount);
    const iAssetToBuy =
      toNumber(pool3.iassetAmount) -
      Math.sqrt(
        (toNumber(pool3.usdiAmount) * toNumber(pool3.iassetAmount)) / prevPrice
      );
    executionEst = calculateExecutionThreshold(iAssetToBuy, true, pool3, 0.002);

    await inceptClient.buyIasset(
      toDevnetScale(iAssetToBuy),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
  });

  it("single pool comet closed! (liquidity withdrawn, ILD payed, collateral withdrawn, and comet closed)", async () => {
    const singlePoolComets = await inceptClient.getSinglePoolComets();
    const singlePoolComet = singlePoolComets.positions[0];
    let poolIndex = Number(singlePoolComet.poolIndex);
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    let lpValue = new BN(getMantissa(singlePoolComet.liquidityTokenValue));
    //await inceptClient.recenterSinglePoolComet(0);
    await inceptClient.withdrawLiquidityFromSinglePoolComet(lpValue, 0);
    await inceptClient.paySinglePoolCometILD(
      0,
      toNumber(singlePoolComets.collaterals[0].collateralAmount) * 10 ** 8
    );
    await inceptClient.withdrawCollateralAndCloseSinglePoolComet(
      usdiTokenAccountInfo.address,
      0
    );

    // mockUSDCTokenAccountInfo =
    //   await getOrCreateAssociatedTokenAccount(inceptClient.provider,
    //     mockUSDCMint.publicKey
    //   );
    // usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(inceptClient.provider,
    //   inceptClient.incept!.usdiMint
    // );
    // iassetTokenAccountInfo =
    //   await getOrCreateAssociatedTokenAccount(inceptClient.provider,
    //     pool.assetInfo.iassetMint
    //   );

    // assert.equal(
    //   Number(mockUSDCTokenAccountInfo.amount) / 10000000,
    //   999978999992.3718,
    //   "check user usdc balance"
    // );
    // assert.equal(
    //   Number(
    //     (
    //       await inceptClient.connection.getTokenAccountBalance(
    //         pool.usdiTokenAccount,
    //         "recent"
    //       )
    //     ).value!.uiAmount
    //   ),
    //   510731.13816819,
    //   "check pool usdi"
    // );
    // assert.equal(
    //   Number(
    //     (
    //       await inceptClient.connection.getTokenAccountBalance(
    //         pool.iassetTokenAccount,
    //         "recent"
    //       )
    //     ).value!.uiAmount
    //   ),
    //   80910.29090819,
    //   "check pool iAsset"
    // );
  });

  it("comet initialized!", async () => {
    await inceptClient.initializeComet();
  });

  it("comet collateral added!", async () => {
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    let comet = await inceptClient.getComet();
    await inceptClient.addCollateralToComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(100000),
      0
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[0];
    comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    assert.equal(
      Number(usdiTokenAccountInfo.amount),
      37973265499945,
      "check user USDi"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(vault.value!.uiAmount, 100000, "check vault balance");

    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        inceptClient.provider,
        mockAssetMint.publicKey
      );

    const nonStableCollateral = tokenData.collaterals[2];

    // Add non-stable collateral
    await inceptClient.addCollateralToComet(
      mockAssetAssociatedTokenAddress.address,
      toDevnetScale(100),
      2
    );

    const nonStableVault = await inceptClient.connection.getTokenAccountBalance(
      nonStableCollateral.vault,
      "recent"
    );

    assert.equal(
      nonStableVault.value!.uiAmount,
      100,
      "check non-stable vault balance"
    );

    comet = await inceptClient.getComet();

    assert.equal(comet.numCollaterals.toNumber(), 2, "check num collaterals");
  });

  it("comet collateral withdrawn!", async () => {
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    let comet = await inceptClient.getComet();

    await inceptClient.withdrawCollateralFromComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(10000),
      0
    );

    comet = await inceptClient.getComet();

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[0];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    assert.closeTo(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      389732.65499945,
      1e-6,
      "check user USDi"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 90000, "check vault balance");

    comet = await inceptClient.getComet();

    assert.equal(comet.numCollaterals.toNumber(), 2, "check num collaterals");
  });

  it("comet liquidity added!", async () => {
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    await inceptClient.addLiquidityToComet(new BN(400000000), 0);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];

    assert.closeTo(
      toNumber(pool.usdiAmount),
      518695.30589505,
      1e-6,
      "check usdi pool balance"
    );

    assert.closeTo(
      toNumber(pool.iassetAmount),
      80946.70452569,
      1e-6,
      "check iasset pool balance"
    );
  });

  it("comet health check", async () => {
    let comet = await inceptClient.getComet();
    let tokenData = await inceptClient.getTokenData();
    let healthScore = getHealthScore(tokenData, comet);

    assert.closeTo(
      healthScore.healthScore,
      99.99995293331263,
      1e-4,
      "check health score."
    );
    await inceptClient.program.methods
      .updatePoolParameters(0, {
        positionHealthScoreCoefficient: {
          value: convertToRawDecimal(healthScoreCoefficient * 2),
        },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    // await inceptClient.program.methods
    //   .updatePoolParameters(0, {
    //     healthScoreCoefficient: {
    //       value: convertToRawDecimal(healthScoreCoefficient * 2),
    //     },
    //   })
    //   .accounts({
    //     admin: inceptClient.incept!.admin,
    //     incept: inceptClient.inceptAddress[0],
    //     tokenData: inceptClient.incept!.tokenData,
    //   })
    //   .rpc();

    await inceptClient.program.methods
      .updatePoolParameters(0, {
        ilHealthScoreCoefficient: {
          value: convertToRawDecimal(ilHealthScoreCoefficient * 2),
        },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    await sleep(400);
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();

    healthScore = getHealthScore(tokenData, comet);
    assert.closeTo(
      healthScore.healthScore,
      99.99990586662526,
      1e-4,
      "check health score."
    );

    const totalILD = getILD(tokenData, comet);
    const poolILD = getILD(tokenData, comet, 0);

    assert.equal(totalILD[0].ILD, poolILD[0].ILD, "check ILD calculation");
    assert.equal(
      totalILD[0].isUsdi,
      poolILD[0].isUsdi,
      "check ILD calculation"
    );
  });

  it("comet liquidity withdrawn!", async () => {
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    await inceptClient.withdrawLiquidityFromComet(new BN(10000000), 0, 0);
    await sleep(200);

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.closeTo(
      usdiAccountBalance.value.uiAmount!,
      518695.29448399,
      1e-6,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      80946.7027449,
      "check iasset pool balance"
    );
  });

  it("multi pool comet extra tests!", async () => {
    // Increase pool price
    let tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool0 = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool0.assetInfo.iassetMint
    );
    await inceptClient.addLiquidityToComet(new BN(50000000), 0);

    tokenData = await inceptClient.getTokenData();
    const pool1 = tokenData.pools[poolIndex];

    let executionEst = calculateExecutionThreshold(10000, true, pool1, 0.0001);

    await inceptClient.buyIasset(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
    await inceptClient.recenterComet(0, 0);
    await inceptClient.withdrawLiquidityFromComet(new BN(50000000), 0, 0);

    tokenData = await inceptClient.getTokenData();
    const pool2 = tokenData.pools[poolIndex];

    executionEst = calculateExecutionThreshold(15000, false, pool2, 0.0001);

    // Decrease pool price
    await inceptClient.sellIasset(
      new BN(1500000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryUsdiTokenAccount.address
    );
    // Need to buy to get back to original price
    tokenData = await inceptClient.getTokenData();
    const pool3 = tokenData.pools[poolIndex];

    const prevPrice = toNumber(pool1.usdiAmount) / toNumber(pool1.iassetAmount);
    const iAssetToBuy =
      toNumber(pool3.iassetAmount) -
      Math.sqrt(
        (toNumber(pool3.usdiAmount) * toNumber(pool3.iassetAmount)) / prevPrice
      );

    executionEst = calculateExecutionThreshold(
      iAssetToBuy,
      true,
      pool3,
      0.0001
    );

    await inceptClient.buyIasset(
      toDevnetScale(iAssetToBuy),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
  });

  it("hackathon USDI mint", async () => {
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    const currentUSDI = Number(usdiTokenAccountInfo.amount) / 100000000;

    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      500000000000000
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      currentUSDI + 5000000,
      "usdi not minted properly!"
    );
  });

  it("iasset bought!", async () => {
    let poolIndex = 0;
    let tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    let executionEst = calculateExecutionThreshold(10000, true, pool, 0.0001);

    await inceptClient.buyIasset(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.closeTo(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      5310078.80934523,
      1e-6,
      "check user usdi balance."
    );
    assert.closeTo(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      128304.44975713,
      1e-6,
      "check user iAsset balance."
    );
    assert.closeTo(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      597311.67837547,
      1e-6,
      "check pool usdi"
    );
    assert.closeTo(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      71085.69425883,
      1e-6,
      "check pool iAsset"
    );
  });

  it("comet recentered!", async () => {
    let poolIndex = 0;
    let tokenData = await inceptClient.getTokenData();
    let comet = await inceptClient.getComet();
    let startingCollateral = toNumber(comet.collaterals[0].collateralAmount);
    const pool = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    let recenterCometEstimation = calculateCometRecenterMultiPool(
      0,
      tokenData,
      comet
    );

    await inceptClient.recenterComet(0, 0);

    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getComet();
    let healthScore = getHealthScore(tokenData, comet);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    let currentCollateral = toNumber(comet.collaterals[0].collateralAmount);

    assert.closeTo(
      healthScore.healthScore,
      recenterCometEstimation.healthScore,
      0.02
    );
    assert.closeTo(
      startingCollateral - currentCollateral,
      recenterCometEstimation.usdiCost,
      0.002
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      5310078.80934523,
      "check user usdi balance"
    );
    assert.closeTo(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      128304.44975713,
      1e-6,
      "check user iAsset balance"
    );
    assert.closeTo(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      597311.66099495,
      1e-6,
      "check pool usdi"
    );
    assert.closeTo(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      71085.69632728,
      1e-6,
      "check pool iAsset"
    );
  });

  let assetMint;
  let jupiterAccount;
  let assetAssociatedTokenAddress;
  let usdcAssociatedTokenAddress;

  it("mint USDC and swap for some mock asset", async () => {
    jupiterAccount = await jupiterProgram.account.jupiter.fetch(jupiterAddress);
    assetMint = jupiterAccount.assetMints[0];
    let usdcMint = jupiterAccount.usdcMint;
    assetAssociatedTokenAddress = await getAssociatedTokenAddress(
      assetMint,
      inceptProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      jupiterAccount.usdcMint,
      inceptProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await jupiterProgram.methods
      .mintUsdc(jupiterNonce, new BN(10000 * 10000000))
      .accounts({
        usdcMint: usdcMint,
        usdcTokenAccount: usdcAssociatedTokenAddress,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Swap 10 asset out.
    await jupiterProgram.methods
      .swap(jupiterNonce, 0, false, true, new BN(10 * 100000000))
      .accounts({
        user: jupiterProgram.provider.publicKey!,
        jupiterAccount: jupiterAddress,
        assetMint: assetMint,
        usdcMint: usdcMint,
        userAssetTokenAccount: assetAssociatedTokenAddress,
        userUsdcTokenAccount: usdcAssociatedTokenAddress,
        pythOracle: jupiterAccount.oracles[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

  it("Pay ILD using collateral", async () => {
    let comet = await inceptClient.getComet();
    let tokenData = await inceptClient.getTokenData();
    const comet1TotalCollateral = getEffectiveUSDCollateralValue(
      tokenData,
      comet
    );
    const healthScore1 = getHealthScore(tokenData, comet);
    await inceptClient.payCometILD(0, 0, toDevnetScale(1).toNumber());
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    const comet2TotalCollateral = getEffectiveUSDCollateralValue(
      tokenData,
      comet
    );
    const healthScore2 = getHealthScore(tokenData, comet);
    assert.closeTo(
      healthScore2.ildHealthImpact,
      0,
      1e-6,
      "ILD should be near zero."
    );
    assert.equal(
      comet1TotalCollateral - 1,
      comet2TotalCollateral,
      "collateral should decrease"
    );
  });

  it("multipool comet liquidation", async () => {
    let tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    let pool = tokenData.pools[poolIndex];
    let comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      8000000 * 100000000
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    let buyAmount = toDevnetScale(29998);

    let executionEst = calculateExecutionThreshold(29998, true, pool, 0.0001);

    await inceptClient.buyIasset(
      buyAmount,
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(3000000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        ilHealthScoreCoefficient: { value: convertToRawDecimal(0.00001) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
    // Check that the score is zero.
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    let healthScore1 = getHealthScore(tokenData, comet);

    assert.isBelow(healthScore1.healthScore, 0, "require unhealthy comet.");

    let userAddress = await inceptClient.getUserAddress();
    assert.equal(comet.collaterals[1].collateralIndex, 2);

    tokenData = await inceptClient.getTokenData();
    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        inceptClient.provider,
        mockAssetMint.publicKey
      );

    let user = await inceptClient.getUserAccount();
    let swapNonstableIx =
      await inceptClient.swapCometNonstableCollateralInstruction(
        inceptClient.provider.publicKey!,
        { userPubKey: userAddress.userPubkey, bump: userAddress.bump },
        user,
        comet,
        tokenData,
        new BN(1000 * 100000000),
        1,
        0,
        usdiTokenAccountInfo.address,
        mockAssetAssociatedTokenAddress.address
      );

    await inceptClient.provider.sendAndConfirm!(
      new Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(swapNonstableIx)
    );

    await sleep(200);
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    let healthScore2 = getHealthScore(tokenData, comet);

    assert.isAbove(
      healthScore2.healthScore,
      healthScore1.healthScore,
      "check liquidation for swapping collateral!"
    );

    await inceptClient.program.methods
      .updatePoolParameters(0, {
        ilHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    let position = comet.positions[0];
    pool = tokenData.pools[position.poolIndex];

    let liquidationIx = await inceptClient.liquidateCometInstruction(
      inceptClient.provider.publicKey!,
      { userPubKey: userAddress.userPubkey, bump: userAddress.bump },
      user,
      comet,
      tokenData,
      0,
      usdiTokenAccountInfo.address
    );

    await inceptClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(liquidationIx)
    );
    await sleep(400);
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    let healthScore4 = getHealthScore(tokenData, comet);

    assert.closeTo(
      healthScore4.healthScore,
      20,
      1e-2,
      "check liquidation for reducing IL"
    );
  });

  it("Create second pool", async () => {
    let mockAssetMint2 = anchor.web3.Keypair.generate();
    let price = 1;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    let priceFeed2 = await createPriceFeed(pythProgram, price, expo, conf);
    let currentPrice = (await getFeedData(pythProgram, priceFeed2)).aggregate
      .price;
    assert.equal(currentPrice, price, "check initial price");

    let chainlink2 = new ChainLinkOracle(storeProgram);

    await chainlink2.createChainlinkFeed(1, 2);
    await chainlink2.submitAnswer(new BN(1649943158), new BN(100000000));

    await sleep(200);

    await jupiterProgram.methods
      .createAsset(priceFeed2)
      .accounts({
        payer: jupiterProgram.provider.publicKey!,
        assetMint: mockAssetMint2.publicKey,
        jupiterAccount: jupiterAddress,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([mockAssetMint2])
      .rpc();

    const jupiterData = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await inceptClient.initializePool(
      walletPubkey,
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      priceFeed2,
      chainlink.priceFeedPubkey(),
      ilHealthScoreCoefficient,
      healthScoreCoefficient,
      500,
      10,
      jupiterData.assetMints[1]
    );

    // Mint position
    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      8000000 * 100000000
    );

    await sleep(400);

    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[1];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    // Initialize liquidity position
    await inceptClient.initializeBorrowPosition(
      new BN(2000000000000),
      new BN(5000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      1,
      0
    );

    await sleep(200);

    await inceptClient.provideUnconcentratedLiquidity(
      toDevnetScale(20000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      1
    );
  });

  it("multipool comet liquidation, multiple positions", async () => {
    // Create another comet position.
    const poolIndex = 1;
    await inceptClient.addLiquidityToComet(new BN(10000000000), poolIndex);

    await sleep(200);

    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[poolIndex];
    let comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    // Buy to increase price.
    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      8000000 * 100000000
    );

    await sleep(400);

    const treasuryIassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.iassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

    await inceptClient.provider.sendAndConfirm!(
      new Transaction().add(
        await createAssociatedTokenAccountInstruction(
          inceptClient.provider.publicKey!,
          treasuryIassetAssociatedTokenAddress,
          treasuryAddress.publicKey,
          pool.assetInfo.iassetMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    );
    treasuryIassetTokenAccount = await getAccount(
      inceptClient.provider.connection,
      treasuryIassetAssociatedTokenAddress,
      "recent"
    );

    await sleep(400);

    let buyAmount = 1000;

    let executionEst = calculateExecutionThreshold(1000, true, pool, 0.0001);

    await inceptClient.buyIasset(
      toDevnetScale(buyAmount),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    // Change coefficients to create negative health score
    await inceptClient.program.methods
      .updatePoolParameters(0, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(6000000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(3000000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        ilHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
    // Check that the score is zero.
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    let healthScore1 = getHealthScore(tokenData, comet);

    assert.isBelow(healthScore1.healthScore, 0, "require unhealthy comet.");

    let userAddress = await inceptClient.getUserAddress();
    let user = await inceptClient.getUserAccount();

    let position = comet.positions[1];
    pool = tokenData.pools[position.poolIndex];

    // First liquidation call
    let liquidationIx = await inceptClient.liquidateCometInstruction(
      inceptClient.provider.publicKey!,
      { userPubKey: userAddress.userPubkey, bump: userAddress.bump },
      user,
      comet,
      tokenData,
      1,
      usdiTokenAccountInfo.address
    );

    await inceptClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(liquidationIx)
    );
    await sleep(400);
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    position = comet.positions[1];
    pool = tokenData.pools[position.poolIndex];
    let healthScore4 = getHealthScore(tokenData, comet);

    // assert.isBelow(
    //   healthScore4.healthScore,
    //   0,
    //   "health score must still be unhealthy"
    // );

    // assert.closeTo(
    //   toNumber(position.liquidityTokenValue),
    //   0,
    //   1e-2,
    //   "Expected LP tokens to all be withdrawn"
    // );

    // Second liquidation call.
    liquidationIx = await inceptClient.liquidateCometInstruction(
      inceptClient.provider.publicKey!,
      { userPubKey: userAddress.userPubkey, bump: userAddress.bump },
      user,
      comet,
      tokenData,
      0,
      usdiTokenAccountInfo.address
    );

    await inceptClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(liquidationIx)
    );
    await sleep(400);
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    let healthScore5 = getHealthScore(tokenData, comet);

    // assert.closeTo(
    //   healthScore5.healthScore,
    //   20,
    //   1e-2,
    //   "check liquidation for reducing IL"
    // );
  });

  it("single pool comet liquidation", async () => {
    // Create another comet position.
    const poolIndex = 1;
    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(1.059) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
    await sleep(200);
    await inceptClient.provider.sendAndConfirm!(
      new Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(
          await inceptClient.initializeSinglePoolCometInstruction(poolIndex, 0)
        )
        .add(
          await inceptClient.addCollateralToSinglePoolCometInstruction(
            usdiTokenAccountInfo.address,
            toDevnetScale(1000),
            0,
            0
          )
        )
        .add(
          await inceptClient.addLiquidityToSinglePoolCometInstruction(
            toDevnetScale(120),
            0,
            poolIndex
          )
        )
    );
    await sleep(400);
    let comet = await inceptClient.getSinglePoolComets();

    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[poolIndex];
    comet = await inceptClient.getSinglePoolComets();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    // Buy to increase price.
    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      8000000 * 100000000
    );

    await sleep(400);

    const treasuryIassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.iassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

    treasuryIassetTokenAccount = await getAccount(
      inceptClient.provider.connection,
      treasuryIassetAssociatedTokenAddress,
      "recent"
    );

    await sleep(400);

    let buyAmount = 1000;

    let executionEst = calculateExecutionThreshold(1000, true, pool, 0.0001);

    await inceptClient.buyIasset(
      toDevnetScale(buyAmount),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
    // Change coefficients to create negative health score
    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(3000000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        ilHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
    // Check that the score is zero.
    comet = await inceptClient.getSinglePoolComets();
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[poolIndex];
    let healthScore1 = getSinglePoolHealthScore(0, tokenData, comet);

    assert.isBelow(healthScore1.healthScore, 0, "require unhealthy comet.");

    let userAddress = await inceptClient.getUserAddress();
    let user = await inceptClient.getUserAccount();

    let position = comet.positions[0];
    pool = tokenData.pools[poolIndex];

    // First liquidation call
    let liquidationIx = await inceptClient.liquidateSinglePoolCometInstruction(
      inceptClient.provider.publicKey!,
      userAddress,
      user,
      comet,
      tokenData,
      0,
      usdiTokenAccountInfo.address
    );

    await inceptClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(liquidationIx)
    );
    // await inceptClient.recenterSinglePoolComet(0);
    await sleep(400);
    comet = await inceptClient.getSinglePoolComets();
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    position = comet.positions[0];
    let collateral_pos = comet.collaterals[0];

    let healthScore5 = getSinglePoolHealthScore(0, tokenData, comet);
    assert.closeTo(
      healthScore5.healthScore,
      20,
      1,
      "check liquidation for reducing IL"
    );
  });

  it("borrow position liquidation", async () => {
    let tokenData = await inceptClient.getTokenData();
    let userMintPositions = await inceptClient.getBorrowPositions();
    let positionIndex = 1;
    let position = userMintPositions.borrowPositions[positionIndex];
    let poolIndex = Number(position.poolIndex);
    let collateralIndex = Number(position.collateralIndex);
    let collateral = tokenData.collaterals[collateralIndex];
    let pool = tokenData.pools[poolIndex];
    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      collateral.mint
    );
    let iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    // Mint more iasset to pay for liquidation.
    await inceptClient.initializeBorrowPosition(
      toDevnetScale(19000),
      toDevnetScale(35000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      1,
      0
    );

    userMintPositions = await inceptClient.getBorrowPositions();
    let numMintPositions = userMintPositions.numPositions.toNumber();

    let priceThreshold =
      toNumber(position.collateralAmount) /
      (1.5 * toNumber(position.borrowedIasset));

    await setPrice(
      pythProgram,
      priceThreshold * 1.1,
      pool.assetInfo.priceFeedAddresses[0]
    );

    await inceptClient.provider.sendAndConfirm!(
      new Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(
          await inceptClient.liquidateBorrowPositionInstruction(
            inceptClient.provider.publicKey!,
            positionIndex,
            collateralTokenAccountInfo.address,
            iassetTokenAccountInfo.address
          )
        )
    );
    userMintPositions = await inceptClient.getBorrowPositions();
    assert.equal(
      numMintPositions - 1,
      userMintPositions.numPositions.toNumber(),
      "Liquidation did not finish!"
    );

    // Reset params
    await inceptClient.program.methods
      .updatePoolParameters(0, {
        positionHealthScoreCoefficient: {
          value: convertToRawDecimal(healthScoreCoefficient),
        },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();

    await inceptClient.program.methods
      .updatePoolParameters(0, {
        ilHealthScoreCoefficient: {
          value: convertToRawDecimal(ilHealthScoreCoefficient),
        },
      })
      .accounts({
        admin: inceptClient.incept!.admin,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
      })
      .rpc();
  });

  let cometManagerInfo: any;
  let cometManagerInfoAddress;

  it("comet manager initialized!", async () => {
    let cometAccount = anchor.web3.Keypair.generate();

    const [managerInfoAddress, managerInfoBump] =
      await PublicKey.findProgramAddress(
        [
          Buffer.from("manager-info"),
          inceptClient.provider.publicKey!.toBuffer(),
        ],
        cometManagerProgram.programId
      );
    cometManagerInfoAddress = managerInfoAddress;

    const [userAccountAddress, userAccountBump] =
      await PublicKey.findProgramAddress(
        [Buffer.from("user"), managerInfoAddress.toBuffer()],
        inceptClient.programId
      );

    let createIx = await inceptClient.program.account.comet.createInstruction(
      cometAccount
    );

    let createManagerIx = await cometManagerProgram.methods
      .initialize(userAccountBump, 2000, 16)
      .accounts({
        admin: inceptClient.provider.publicKey!,
        managerInfo: managerInfoAddress,
        userAccount: userAccountAddress,
        comet: cometAccount.publicKey,
        incept: inceptClient.inceptAddress[0],
        inceptProgram: inceptClient.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    await inceptClient.provider.sendAndConfirm!(
      new Transaction().add(createIx).add(createManagerIx),
      [cometAccount]
    );

    await sleep(400);

    let cometManagerUser = await inceptClient.getUserAccount(
      userAccountAddress
    );
    assert.isTrue(
      cometManagerUser.authority.equals(managerInfoAddress),
      "Authority"
    );
    assert.isTrue(
      cometManagerUser.comet.equals(cometAccount.publicKey),
      "comet account"
    );

    cometManagerInfo = (await cometManagerProgram.account.managerInfo.fetch(
      managerInfoAddress
    )) as ManagerInfo;
    assert.isTrue(
      cometManagerInfo.inceptProgram.equals(inceptClient.programId),
      "incept program id"
    );
    assert.isTrue(
      cometManagerInfo.incept.equals(inceptClient.inceptAddress[0]),
      "incept manager"
    );
    assert.isTrue(
      cometManagerInfo.owner.equals(inceptClient.provider.publicKey!),
      "comet manager owner"
    );
    assert.isTrue(
      cometManagerInfo.userAccount.equals(userAccountAddress),
      "user account address"
    );
    assert.equal(cometManagerInfo.userBump, userAccountBump, "user bump");
    assert.equal(cometManagerInfo.bump, managerInfoBump, "manager info bump");
  });

  let subscribeAccountAddress: PublicKey;
  it("create comet manager subscriber", async () => {
    subscribeAccountAddress = (
      await PublicKey.findProgramAddress(
        [
          Buffer.from("subscriber"),
          inceptClient.provider.publicKey!.toBuffer(),
          cometManagerInfoAddress.toBuffer(),
        ],
        cometManagerProgram.programId
      )
    )[0];

    await cometManagerProgram.methods
      .initializeSubscription()
      .accounts({
        subscriber: subscribeAccountAddress,
        subscriptionOwner: inceptClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([])
      .rpc();

    await sleep(400);

    let subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;

    assert.isTrue(
      subscriberAccount.owner.equals(inceptClient.provider.publicKey!)
    );
    assert.isTrue(subscriberAccount.manager.equals(cometManagerInfoAddress));
    assert.equal(subscriberAccount.principal.toNumber(), 0, "principal amount");
    assert.equal(
      subscriberAccount.membershipTokens.toNumber(),
      0,
      "membership tokens"
    );
  });

  it("comet manager subscription!", async () => {
    let subscriberUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );
    let currentUsdiBalance =
      Number(subscriberUsdiTokenAccount.amount) / 100000000;
    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await inceptClient.getTokenData();
    await cometManagerProgram.methods
      .subscribe(toDevnetScale(100))
      .accounts({
        subscriber: cometManagerProgram.provider.publicKey!,
        subscriberAccount: subscribeAccountAddress,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        managerInceptUser: cometManagerInfo.userAccount,
        usdiMint: inceptClient.incept!.usdiMint,
        subscriberUsdiTokenAccount: subscriberUsdiTokenAccount.address,
        managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
        inceptProgram: inceptClient.programId,
        comet: cometManagerUser.comet,
        tokenData: inceptClient.incept!.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await sleep(400);

    let subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;
    subscriberUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );
    let comet = await inceptClient.getComet(cometManagerInfo.userAccount);
    cometManagerInfo = (await cometManagerProgram.account.managerInfo.fetch(
      cometManagerInfoAddress
    )) as ManagerInfo;

    assert.equal(
      Number(subscriberAccount.membershipTokens) / 100000000,
      100,
      "membership token"
    );
    assert.equal(
      Number(subscriberAccount.principal) / 100000000,
      100,
      "principal"
    );

    assert.equal(
      Number(cometManagerInfo.membershipTokenSupply) / 100000000,
      100,
      "membership token supply"
    );

    assert.equal(
      Number(subscriberUsdiTokenAccount.amount) / 100000000,
      currentUsdiBalance - 100,
      "usdi balance"
    );

    assert.equal(
      toNumber(comet.collaterals[0].collateralAmount),
      100,
      "collateral amount"
    );

    assert.equal(comet.collaterals[0].collateralIndex, 0, "collateral index");
  });

  it("comet manager add liquidity ", async () => {
    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await inceptClient.getTokenData();
    let poolIndex = 0;
    let usdiAmount = 120;

    let tx = new Transaction()
      .add(await inceptClient.updatePricesInstruction())
      .add(
        await cometManagerProgram.methods
          .addLiquidity(poolIndex, toDevnetScale(usdiAmount))
          .accounts({
            managerOwner: inceptClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            managerInceptUser: cometManagerInfo.userAccount,
            usdiMint: inceptClient.incept!.usdiMint,
            inceptProgram: inceptClient.programId,
            comet: cometManagerUser.comet,
            tokenData: inceptClient.incept!.tokenData,
            iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
            ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
            ammIassetTokenAccount:
              tokenData.pools[poolIndex].iassetTokenAccount,
            liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
            cometLiquidityTokenAccount:
              tokenData.pools[poolIndex].cometLiquidityTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

    await inceptClient.provider.sendAndConfirm!(tx);
    await sleep(400);

    let comet = await inceptClient.getComet(cometManagerInfo.userAccount);
    assert.equal(Number(comet.numPositions), 1, "Number positions");
    assert.equal(
      toNumber(comet.positions[0].borrowedUsdi),
      usdiAmount,
      "Usdi position size"
    );
  });

  it("comet manager recenter!", async () => {
    let tokenData = await inceptClient.getTokenData();
    let comet = await inceptClient.getComet(cometManagerInfo.userAccount);
    let poolIndex = 0;
    let pool = tokenData.pools[poolIndex];
    let healthScore = getHealthScore(tokenData, comet);

    // Sell to change the price,
    let executionEst = calculateExecutionThreshold(100, false, pool, 0.0001);

    let iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    await inceptClient.sellIasset(
      toDevnetScale(100),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      new BN(executionEst.usdiThresholdAmount),
      treasuryUsdiTokenAccount.address
    );

    // Recenter
    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getComet(cometManagerInfo.userAccount);
    let healthScoreFinal = getHealthScore(tokenData, comet);

    assert.isAbove(
      healthScore.healthScore,
      healthScoreFinal.healthScore,
      "ILD creation"
    );
    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    pool = tokenData.pools[poolIndex];

    let ix = await cometManagerProgram.methods
      .recenter(0)
      .accounts({
        managerOwner: inceptClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        managerInceptUser: cometManagerInfo.userAccount,
        usdiMint: inceptClient.incept!.usdiMint,
        inceptProgram: inceptClient.programId,
        comet: cometManagerUser.comet,
        tokenData: inceptClient.incept!.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
      })
      .instruction();

    let tx = new Transaction().add(ix);

    await inceptClient.provider.sendAndConfirm!(tx);
  });

  it("comet manager fee claim", async () => {
    let subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;
    let startingTokens = subscriberAccount.membershipTokens;

    await cometManagerProgram.methods
      .managementFeeClaim()
      .accounts({
        managerOwner: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        ownerAccount: subscribeAccountAddress,
      })
      .rpc();

    await sleep(400);

    subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;

    assert.isAbove(
      Number(subscriberAccount.membershipTokens),
      Number(startingTokens),
      "token claim"
    );
  });

  it("comet manager withdraw liquidity", async () => {
    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await inceptClient.getTokenData();
    let poolIndex = 0;
    let comet = await inceptClient.getComet(cometManagerInfo.userAccount);

    // Withdraw all liquidity
    await cometManagerProgram.methods
      .withdrawLiquidity(
        0,
        toDevnetScale(toNumber(comet.positions[0].liquidityTokenValue))
      )
      .accounts({
        signer: inceptClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        managerInceptUser: cometManagerInfo.userAccount,
        usdiMint: inceptClient.incept!.usdiMint,
        inceptProgram: inceptClient.programId,
        comet: cometManagerUser.comet,
        tokenData: inceptClient.incept!.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[poolIndex].cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await sleep(400);

    comet = await inceptClient.getComet(cometManagerInfo.userAccount);

    assert.equal(
      toNumber(comet.positions[0].borrowedUsdi),
      0,
      "Usdi position size"
    );
    assert.equal(
      toNumber(comet.positions[0].borrowedIasset),
      0,
      "Iasset position size"
    );
    assert.equal(
      toNumber(comet.collaterals[0].collateralAmount),
      100.00516674,
      "collateral amount"
    );
  });

  it("comet manager redemption!", async () => {
    let subscriberUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );

    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await inceptClient.getTokenData();
    let subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;

    let tx = new Transaction()
      .add(await inceptClient.updatePricesInstruction())
      .add(
        await cometManagerProgram.methods
          .requestRedemption(subscriberAccount.membershipTokens)
          .accounts({
            subscriber: cometManagerProgram.provider.publicKey!,
            subscriberAccount: subscribeAccountAddress,
            managerInfo: cometManagerInfoAddress,
          })
          .instruction()
      )
      .add(
        await cometManagerProgram.methods
          .fulfillRedemptionRequest(0)
          .accounts({
            managerOwner: inceptClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            managerInceptUser: cometManagerInfo.userAccount,
            subscriberAccount: subscribeAccountAddress,
            usdiMint: inceptClient.incept!.usdiMint,
            subscriberUsdiTokenAccount: subscriberUsdiTokenAccount.address,
            managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
            inceptProgram: inceptClient.programId,
            comet: cometManagerUser.comet,
            tokenData: inceptClient.incept!.tokenData,
            inceptUsdiVault: tokenData.collaterals[0].vault,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .instruction()
      );

    await inceptClient.provider.sendAndConfirm!(tx);

    await sleep(400);

    subscriberUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );
    subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;

    assert.equal(
      Number(subscriberAccount.membershipTokens.toNumber()),
      0,
      "membership tokens"
    );
    assert.equal(
      Number(subscriberAccount.principal.toNumber()),
      0,
      "principal"
    );
    assert.equal(
      Number(subscriberUsdiTokenAccount.amount) / 100000000,
      36802715.68517893,
      "Usdi account"
    );
  });

  it("pay ILD to close out position!", async () => {
    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let comet = await inceptClient.getComet(cometManagerInfo.userAccount);
    let tokenData = await inceptClient.getTokenData();
    let positionIndex = 0;
    let poolIndex = Number(comet.positions[positionIndex].poolIndex);
    let ix = await cometManagerProgram.methods
      .payIld(
        positionIndex,
        toDevnetScale(toNumber(comet.collaterals[0].collateralAmount))
      )
      .accounts({
        signer: inceptClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        managerInceptUser: cometManagerInfo.userAccount,
        usdiMint: inceptClient.incept!.usdiMint,
        inceptProgram: inceptClient.programId,
        comet: cometManagerUser.comet,
        tokenData: inceptClient.incept!.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        iassetMint: tokenData.pools[poolIndex].assetInfo.iassetMint,
        ammUsdiTokenAccount: tokenData.pools[poolIndex].usdiTokenAccount,
        ammIassetTokenAccount: tokenData.pools[poolIndex].iassetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    let tx = new Transaction().add(ix);

    await inceptClient.provider.sendAndConfirm!(tx);

    await sleep(400);

    comet = await inceptClient.getComet(cometManagerInfo.userAccount);

    assert.equal(comet.numPositions.toNumber(), 0, "num positions");
  });

  it("comet manager usdi withdraw", async () => {
    let ownerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );

    let currentUsdiBalance = ownerUsdiTokenAccount.amount;

    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

    let managerUsdiBalance = Number(cometManagerUsdiTokenAccount.amount);

    await cometManagerProgram.methods
      .ownerWithdrawal(new BN(managerUsdiBalance))
      .accounts({
        managerOwner: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        usdiMint: inceptClient.incept!.usdiMint,
        managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
        ownerUsdiTokenAccount: ownerUsdiTokenAccount.address,
      })
      .rpc();

    await sleep(400);

    ownerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );

    cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

    assert.equal(
      Number(ownerUsdiTokenAccount.amount),
      Number(currentUsdiBalance) + managerUsdiBalance,
      "owner usdi account"
    );
    assert.equal(
      Number(cometManagerUsdiTokenAccount.amount),
      0,
      "manager usdi account"
    );
  });

  it("initializing comet manager termination!", async () => {
    let cometManagerUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    await cometManagerProgram.methods
      .initiateCometManagerClosing()
      .accounts({
        signer: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        managerInceptUser: cometManagerInfo.userAccount,
        comet: cometManagerUser.comet,
      })
      .rpc();

    cometManagerInfo = (await cometManagerProgram.account.managerInfo.fetch(
      cometManagerInfoAddress
    )) as ManagerInfo;

    assert.isFalse(
      cometManagerInfo.status.closing.forcefullyClosed,
      "Should be in closing sequence"
    );
  });

  it("comet manager terminated", async () => {
    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );
    let ownerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );
    let tokenData = await inceptClient.getTokenData();

    let cometManagerInceptUser = await inceptClient.getUserAccount(
      cometManagerInfo.userAccount
    );

    await cometManagerProgram.methods
      .closeCometManager()
      .accounts({
        managerOwner: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        managerInceptUser: cometManagerInfo.userAccount,
        usdiMint: inceptClient.incept!.usdiMint,
        managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
        treasuryUsdiTokenAccount: treasuryUsdiTokenAccount.address,
        inceptProgram: inceptClient.programId,
        comet: cometManagerInceptUser.comet,
        tokenData: inceptClient.incept!.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        ownerUsdiTokenAccount: ownerUsdiTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("wrap assets and unwrap iassets", async () => {
    const poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];
    const jupiterData = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    let mockAssetAssociatedTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        inceptClient.provider,
        jupiterData.assetMints[0]
      );

    let iassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    // Get asset from jupiter
    await jupiterProgram.methods
      .mintAsset(jupiterNonce, 0, new BN(10 * 100000000))
      .accounts({
        assetMint: jupiterData.assetMints[0],
        assetTokenAccount: mockAssetAssociatedTokenAccount.address,
        jupiterAccount: jupiterAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      jupiterData.assetMints[0]
    );

    let startingAssetBalance = Number(mockAssetAssociatedTokenAccount.amount);
    let startingIassetBalance = Number(iassetAssociatedTokenAccount.amount);

    let amount = toDevnetScale(5);
    let [inceptAddress, bump] = await inceptClient.getInceptAddress();

    // Wrap to iasset
    await inceptProgram.methods
      .wrapAsset(amount, poolIndex)
      .accounts({
        user: inceptClient.provider.publicKey!,
        tokenData: inceptClient.incept!.tokenData,
        underlyingAssetTokenAccount: pool.underlyingAssetTokenAccount!,
        assetMint: jupiterData.assetMints[0],
        userAssetTokenAccount: mockAssetAssociatedTokenAccount.address,
        iassetMint: pool.assetInfo.iassetMint,
        userIassetTokenAccount: iassetAssociatedTokenAccount.address,
        incept: inceptClient.inceptAddress[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      jupiterData.assetMints[0]
    );
    iassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      startingAssetBalance - Number(mockAssetAssociatedTokenAccount.amount),
      Number(amount),
      "check asset"
    );
    assert.equal(
      Number(iassetAssociatedTokenAccount.amount) - startingIassetBalance,
      Number(amount),
      "check iasset"
    );

    // Unwrap to asset
    await inceptProgram.methods
      .unwrapIasset(amount, poolIndex)
      .accounts({
        user: inceptClient.provider.publicKey!,
        tokenData: inceptClient.incept!.tokenData,
        underlyingAssetTokenAccount: pool.underlyingAssetTokenAccount!,
        assetMint: jupiterData.assetMints[0],
        userAssetTokenAccount: mockAssetAssociatedTokenAccount.address,
        iassetMint: pool.assetInfo.iassetMint,
        userIassetTokenAccount: iassetAssociatedTokenAccount.address,
        incept: inceptAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      jupiterData.assetMints[0]
    );
    iassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    assert.equal(
      Number(mockAssetAssociatedTokenAccount.amount),
      startingAssetBalance
    );
    assert.equal(
      Number(iassetAssociatedTokenAccount.amount),
      startingIassetBalance
    );
  });
});
