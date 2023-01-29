import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { Store } from "../sdk/src/idl/store";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import { Incept as InceptConnection, toDevnetScale } from "../sdk/src/incept";
import {
  createPriceFeed,
  setPrice,
  getFeedData,
  ChainLinkOracle,
} from "../sdk/src/oracle";
import { calculateExecutionThreshold, sleep } from "../sdk/src/utils";
import { getMantissa, toNumber } from "../sdk/src/decimal";
import { getOrCreateAssociatedTokenAccount } from "./utils";
import {
  calculateEditCometSinglePoolWithUsdiBorrowed,
  getSinglePoolHealthScore,
  getHealthScore,
  getEffectiveUSDCollateralValue,
  calculateCometRecenterSinglePool,
  calculateCometRecenterMultiPool,
  getILD,
} from "../sdk/src/healthscore";

describe("incept", async () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  let inceptProgram = anchor.workspace.Incept as Program<Incept>;
  let pythProgram = anchor.workspace.Pyth as Program<Pyth>;
  let walletPubkey = inceptProgram.provider.publicKey!;
  let storeProgram = anchor.workspace.Store as Program<Store>;
  let jupiterProgram = anchor.workspace
    .JupiterAggMock as Program<JupiterAggMock>;
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
  const poolTradingFee = 2;
  const treasuryTradingFee = 1;
  const collateralFullLiquidationThreshold = 25;

  let priceFeed;
  let mockUSDCTokenAccountInfo;
  let usdiTokenAccountInfo;
  let iassetTokenAccountInfo;
  let liquidityTokenAccountInfo;
  let inceptClient = new InceptConnection(
    inceptProgram.programId,
    provider
  ) as InceptConnection;

  const mockAssetMint = anchor.web3.Keypair.generate();
  let [jupiterAddress, jupiterNonce] = await PublicKey.findProgramAddress(
    [anchor.utils.bytes.utf8.encode("jupiter")], //, jupiterProgram.provider.wallet.publicKey.toBuffer()],
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
    await inceptClient.initializeManager(
      storeProgram.programId,
      ilHealthScoreCoefficient,
      ilHealthScoreCutoff,
      ilLiquidationRewardPct,
      maxHealthLiquidation,
      liquidatorFee,
      collateralFullLiquidationThreshold,
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
      userAccountData.mintPositions.equals(anchor.web3.PublicKey.default),
      "check mint position address"
    );
    assert(
      userAccountData.liquidityPositions.equals(anchor.web3.PublicKey.default),
      "check liquidity position address"
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
    await inceptClient.initializePool(
      walletPubkey,
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      priceFeed,
      chainlink.priceFeedPubkey(),
      healthScoreCoefficient,
      500
    );
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
    assert.equal(tokenData.collaterals[2].stable, 0);
  });

  it("token data initialization check", async () => {
    const tokenData = await inceptClient.getTokenData();

    assert(
      tokenData.manager.equals(inceptClient.managerAddress[0]),
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
      !first_pool.liquidationIassetTokenAccount.equals(
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
    // for (let i = 0; i < 1; i++) {
    //   await mockUSDCProgram.rpc.mintMockUsdc(mockUSDCAccount[1], {
    //     accounts: {
    //       mockUsdcMint: mockUSDCMint.publicKey,
    //       mockUsdcTokenAccount: mockUSDCTokenAccountInfo.address,
    //       mockUsdcAccount: mockUSDCAccount[0],
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //     },
    //     signers: [],
    //   });
    // }
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
      inceptClient.manager!.usdiMint
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
      inceptClient.manager!.usdiMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      1000000,
      "check iasset token amount"
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

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.initializeMintPosition(
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

    const mintPosition = (await inceptClient.getMintPositions())
      .mintPositions[0];

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

    await inceptClient.closeMintPosition(
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
    await inceptClient.initializeMintPosition(
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

    await inceptClient.addCollateralToMint(
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

    await inceptClient.withdrawCollateralFromMint(
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
    let assetInfo = tokenData.pools[0].assetInfo;

    await inceptProgram.methods
      .payBackMint(inceptClient.managerAddress[1], new BN(0), new BN(5000000))
      .accounts({
        user: walletPubkey,
        manager: inceptClient.managerAddress[0],
        tokenData: inceptClient.manager!.tokenData,
        userIassetTokenAccount: iassetTokenAccountInfo.address,
        mintPositions: userAccountData.mintPositions,
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

    await inceptClient.addiAssetToMint(
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    await inceptClient.initializeLiquidityPosition(
      new BN(10000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      0
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    await inceptClient.provideLiquidity(
      new BN(100000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.liquidityTokenMint
    );

    await inceptClient.withdrawLiquidity(
      new BN(45453545454500),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];
    const purchaseAmount = 10000;

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
      inceptClient.manager!.usdiMint,
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
            inceptClient.manager!.usdiMint,
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

    await inceptClient.buySynth(
      toDevnetScale(purchaseAmount),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
      118889.70909181,
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
      81007.19812468,
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    let executionEst = calculateExecutionThreshold(10000, false, pool, 0.0001);

    await inceptClient.sellSynth(
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      541954.25491843,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      108889.70909181,
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
      457482.39305906,
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
      91007.19812468,
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
      inceptClient.manager!.usdiMint
    );
    assert.equal(
      Number(usdiTokenAccountInfo.amount),
      54195475491843,
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

    // Estimate using edit.
    // const estimation =
    //   await inceptClient.calculateEditCometSinglePoolWithUsdiBorrowed(
    //     0,
    //     0,
    //     510
    //   );

    // const comet = await inceptClient.getSinglePoolComets()[0];
    // const position = comet.positions[0];
    // let positionBorrowedUsdi = toScaledNumber(position.borrowedUsdi) + 510;

    // const estimationWithLowerPrice =
    //   await inceptClient.calculateEditCometSinglePoolWithRange(
    //     0,
    //     0,
    //     estimation.lowerPrice,
    //     true
    //   );

    // assert.closeTo(
    //   positionBorrowedUsdi,
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
    //   positionBorrowedUsdi,
    //   estimationWithUpperPrice.usdiPosition,
    //   1e-3
    // );

    // const estimationWithNewComet =
    //   await inceptClient.calculateNewSinglePoolCometFromUsdiBorrowed(
    //     0,
    //     250,
    //     510
    //   );

    // const estimationWithNewCometAndLowerRange =
    //   await inceptClient.calculateNewSinglePoolCometFromRange(
    //     0,
    //     250,
    //     estimationWithNewComet.lowerPrice,
    //     true
    //   );

    // const estimationWithNewCometAndUpperRange =
    //   await inceptClient.calculateNewSinglePoolCometFromRange(
    //     0,
    //     250,
    //     estimationWithNewComet.upperPrice,
    //     false
    //   );

    // assert.closeTo(
    //   estimationWithNewComet.healthScore,
    //   estimation.healthScore,
    //   1e-6,
    //   "check health score estimations"
    // );

    // assert.closeTo(
    //   estimationWithNewCometAndLowerRange.usdiBorrowed,
    //   510,
    //   1e-6,
    //   "check lower range estimations"
    // );

    // assert.closeTo(
    //   estimationWithNewCometAndUpperRange.usdiBorrowed,
    //   510,
    //   1e-6,
    //   "check upper range estimations"
    // );

    await inceptClient.addLiquidityToSinglePoolComet(new BN(51000000000), 0);

    await sleep(200);

    // const health = await inceptClient.getSinglePoolHealthScore(0);

    // assert.closeTo(estimation.healthScore, health.healthScore, 0.01);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      457992.39305906,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91108.65267626,
      "check iasset pool balance"
    );
  });

  it("single pool comet liquidity subtracted!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
      457982.32857926,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91106.65054433,
      "check iasset pool balance"
    );
  });

  it("iasset bought!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    const executionEst = calculateExecutionThreshold(10000, true, pool, 0.0001);

    await inceptClient.buySynth(
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      483518.85314659,
      "check user usdi balance."
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      118689.70909181,
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
      516418.2303511,
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
      81203.55776082,
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
      inceptClient.manager!.usdiMint
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

    assert.isAbove(
      info2.healthScore,
      info.healthScore,
      "recenter comet should increase health!"
    );

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
      516487.06305796,
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
      81192.73568784,
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
      inceptClient.manager!.usdiMint
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
    await inceptClient.buySynth(
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
    await inceptClient.sellSynth(
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

    await inceptClient.buySynth(
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
      inceptClient.manager!.usdiMint
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
    //   inceptClient.manager!.usdiMint
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
      inceptClient.manager!.usdiMint
    );

    let comet = await inceptClient.getComet();
    await inceptClient.addCollateralToComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(100000),
      0,
      false
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[0];
    comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );
    assert.equal(
      Number(usdiTokenAccountInfo.amount),
      37902643995704,
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
      2,
      false
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
      inceptClient.manager!.usdiMint
    );

    let comet = await inceptClient.getComet(false);

    await inceptClient.withdrawCollateralFromComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(10000),
      0,
      false
    );

    comet = await inceptClient.getComet(false);

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[0];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );
    assert.closeTo(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      389026.43995704,
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
      inceptClient.manager!.usdiMint
    );

    await inceptClient.addLiquidityToComet(new BN(400000000), 0, false);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];

    assert.closeTo(
      toNumber(pool.usdiAmount),
      519410.7364801,
      1e-6,
      "check usdi pool balance"
    );

    assert.closeTo(
      toNumber(pool.iassetAmount),
      81553.49339444,
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

    await inceptClient.updatePoolHealthScoreCoefficient(
      healthScoreCoefficient * 2,
      0
    );
    await inceptClient.updateILHealthScoreCoefficient(
      ilHealthScoreCoefficient * 2
    );
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    await inceptClient.withdrawLiquidityFromComet(
      new BN(10000000),
      0,
      0,
      false
    );
    await sleep(200);

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.closeTo(
      usdiAccountBalance.value.uiAmount!,
      //usdiAccountBalance.value!.uiAmount,
      519410.72505338,
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
      81553.4916003,
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool0.assetInfo.iassetMint
    );
    await inceptClient.addLiquidityToComet(new BN(50000000), 0, false);

    tokenData = await inceptClient.getTokenData();
    const pool1 = tokenData.pools[poolIndex];

    let executionEst = calculateExecutionThreshold(10000, true, pool1, 0.0001);

    await inceptClient.buySynth(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
    await inceptClient.recenterComet(0, 0, false);
    await inceptClient.withdrawLiquidityFromComet(
      new BN(50000000),
      0,
      0,
      false
    );

    tokenData = await inceptClient.getTokenData();
    const pool2 = tokenData.pools[poolIndex];

    executionEst = calculateExecutionThreshold(15000, false, pool2, 0.0001);

    // Decrease pool price
    await inceptClient.sellSynth(
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

    await inceptClient.buySynth(
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
      inceptClient.manager!.usdiMint
    );

    const currentUSDI = Number(usdiTokenAccountInfo.amount) / 100000000;

    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      500000000000000
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      currentUSDI + 5000000,
      "usdi not minted properly!"
    );
  });

  it("iasset bought!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    let executionEst = calculateExecutionThreshold(10000, true, pool, 0.0001);

    await inceptClient.buySynth(
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
      inceptClient.manager!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.closeTo(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      5309311.25502155,
      1e-6,
      "check user usdi balance."
    );
    assert.closeTo(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      127289.22844785,
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
      598097.79385101,
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
      72099.14300706,
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
      inceptClient.manager!.usdiMint
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

    await inceptClient.recenterComet(0, 0, false);

    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getComet();
    let healthScore = getHealthScore(tokenData, comet);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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
      5309311.25502155,
      "check user usdi balance"
    );
    assert.closeTo(
      Number(iassetTokenAccountInfo.amount) / 100000000,
      127289.22844785,
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
      598097.76209015,
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
      72099.14683575,
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
    await inceptClient.payCometILD(0, 0, toDevnetScale(1).toNumber(), false);
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
      inceptClient.manager!.usdiMint
    );

    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      8000000 * 100000000
    );

    await sleep(200);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );

    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    let buyAmount = toDevnetScale(29998);

    let executionEst = calculateExecutionThreshold(29998, true, pool, 0.0001);

    await inceptClient.buySynth(
      buyAmount,
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    await sleep(2000);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
    );

    await inceptClient.updatePoolHealthScoreCoefficient(3000000, poolIndex);
    await inceptClient.updateILHealthScoreCoefficient(0.00001);
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

    await inceptClient.updateILHealthScoreCoefficient(100000);
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

    await inceptClient.initializePool(
      walletPubkey,
      150,
      200,
      poolTradingFee,
      treasuryTradingFee,
      priceFeed2,
      chainlink.priceFeedPubkey(),
      healthScoreCoefficient,
      500
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
      inceptClient.manager!.usdiMint
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
    await inceptClient.initializeMintPosition(
      new BN(2000000000000),
      new BN(5000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      1,
      0
    );

    await sleep(200);

    await inceptClient.initializeLiquidityPosition(
      new BN(2000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      1
    );
  });

  it("multipool comet liquidation, multiple positions", async () => {
    // Create another comet position.
    const poolIndex = 1;
    await inceptClient.addLiquidityToComet(
      new BN(10000000000),
      poolIndex,
      false
    );

    await sleep(200);

    let tokenData = await inceptClient.getTokenData();
    let pool = tokenData.pools[poolIndex];
    let comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.manager!.usdiMint
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

    await inceptClient.buySynth(
      toDevnetScale(buyAmount),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );

    // Change coefficients to create negative health score
    await inceptClient.updatePoolHealthScoreCoefficient(6000000, 0);
    await inceptClient.updatePoolHealthScoreCoefficient(3000000, poolIndex);
    await inceptClient.updateILHealthScoreCoefficient(100000);
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
    await inceptClient.updatePoolHealthScoreCoefficient(1.059, poolIndex);
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
      inceptClient.manager!.usdiMint
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

    await inceptClient.buySynth(
      toDevnetScale(buyAmount),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryIassetTokenAccount.address
    );
    // Change coefficients to create negative health score
    await inceptClient.updatePoolHealthScoreCoefficient(3000000, poolIndex);
    await inceptClient.updateILHealthScoreCoefficient(100000);
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
      0.1,
      "check liquidation for reducing IL"
    );
  });

  it("borrow position liquidation", async () => {
    let tokenData = await inceptClient.getTokenData();
    let userMintPositions = await inceptClient.getMintPositions();
    let positionIndex = 1;
    let position = userMintPositions.mintPositions[positionIndex];
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
    await inceptClient.initializeMintPosition(
      toDevnetScale(19000),
      toDevnetScale(35000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      1,
      0
    );

    userMintPositions = await inceptClient.getMintPositions();
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
          await inceptClient.liquidateMintPositionInstruction(
            inceptClient.provider.publicKey!,
            positionIndex,
            collateralTokenAccountInfo.address,
            iassetTokenAccountInfo.address
          )
        )
    );
    userMintPositions = await inceptClient.getMintPositions();
    assert.equal(
      numMintPositions - 1,
      userMintPositions.numPositions.toNumber(),
      "Liquidation did not finish!"
    );
  });
});

//   it("comet closed! (liquidity withdrawn and ILD payed)", async () => {
//     let poolIndex = 0;
//     const tokenData = await inceptClient.getTokenData();
//     const pool = tokenData.pools[poolIndex];

//     usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(inceptClient.provider,
//       inceptClient.manager!.usdiMint
//     );
//     iassetTokenAccountInfo =
//       await getOrCreateAssociatedTokenAccount(inceptClient.provider,
//         pool.assetInfo.iassetMint
//       );

//     await inceptClient.withdrawLiquidityAndPayCometILD(
//       usdiTokenAccountInfo.address,
//       iassetTokenAccountInfo.address,
//       0,
//       false
//     );

//     await sleep(200);

//     usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(inceptClient.provider,
//       inceptClient.manager!.usdiMint
//     );
//     iassetTokenAccountInfo =
//       await getOrCreateAssociatedTokenAccount(inceptClient.provider,
//         pool.assetInfo.iassetMint
//       );

//     assert.equal(
//       Number(usdiTokenAccountInfo.amount) / 100000000,
//       10123570.15392809,
//       "check user usdi balance"
//     );
//     assert.equal(
//       Number(iassetTokenAccountInfo.amount) / 100000000,
//       189087.44860351,
//       "check user iAsset balance"
//     );
//     assert.equal(
//       Number(
//         (
//           await inceptClient.connection.getTokenAccountBalance(
//             pool.usdiTokenAccount,
//             "recent"
//           )
//         ).value!.uiAmount
//       ),
//       3786777.85075596,
//       "check pool usdi"
//     );
//     assert.equal(
//       Number(
//         (
//           await inceptClient.connection.getTokenAccountBalance(
//             pool.iassetTokenAccount,
//             "recent"
//           )
//         ).value!.uiAmount
//       ),
//       10912.55139649,
//       "check pool iAsset"
//     );

//     const comet = await inceptClient.getComet();
//     assert.equal(Number(comet.numPositions), 0, "check comet position");
//   });
// });
