import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";
import { InceptCometManager } from "../sdk/src/idl/incept_comet_manager";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  DEVNET_TOKEN_SCALE,
  InceptClient,
  toDevnetScale,
} from "../sdk/src/incept";
import { createPriceFeed, setPrice, getFeedData } from "../sdk/src/oracle";
import {
  calculateExecutionThreshold,
  sleep,
  recenterProcedureInstructions,
  createTx,
  createVersionedTx,
} from "../sdk/src/utils";
import { getMantissa, toNumber } from "../sdk/src/decimal";
import {
  convertToRawDecimal,
  getOrCreateAssociatedTokenAccount,
  fromDevnetNumber,
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
  let jupiterProgram = anchor.workspace
    .JupiterAggMock as Program<JupiterAggMock>;

  let cometManagerProgram = anchor.workspace
    .InceptCometManager as Program<InceptCometManager>;

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
  let lookupTableAddress;

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
      ilHealthScoreCutoff,
      ilLiquidationRewardPct,
      maxHealthLiquidation,
      liquidatorFee,
      treasuryAddress.publicKey,
      mockUSDCMint.publicKey
    );
  });

  it("user initialized!", async () => {
    let tx = new Transaction();
    tx.add(await inceptClient.initializeUserInstruction());

    const borrowAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await inceptClient.initializeBorrowPositionsAccountInstruction(
        borrowAccountKeypair
      )
    );

    const cometAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await inceptClient.initializeCometInstruction(cometAccountKeypair, false)
    );

    const singlePoolCometAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await inceptClient.initializeCometInstruction(
        singlePoolCometAccountKeypair,
        true
      )
    );

    await inceptClient.provider.sendAndConfirm!(tx, [
      borrowAccountKeypair,
      cometAccountKeypair,
      singlePoolCometAccountKeypair,
    ]);

    let userAccountData = await inceptClient.getUserAccount();

    assert(
      userAccountData.authority.equals(inceptClient.provider.publicKey!),
      "check authority address"
    );
    assert(
      userAccountData.singlePoolComets.equals(
        singlePoolCometAccountKeypair.publicKey
      ),
      "check single pool comets address"
    );
    assert(
      userAccountData.borrowPositions.equals(borrowAccountKeypair.publicKey),
      "check mint position address"
    );
    assert(
      userAccountData.comet.equals(cometAccountKeypair.publicKey),
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
      ilHealthScoreCoefficient,
      healthScoreCoefficient,
      500,
      10,
      jupiterData.assetMints[0]
    );

    let tokenData = await inceptClient.getTokenData();
    assert.equal(tokenData.numPools.toNumber(), 1);
  });

  it("non-stable mock asset added as a collateral!", async () => {
    await inceptClient.addCollateral(
      walletPubkey,
      8,
      false,
      mockAssetMint.publicKey,
      200,
      0
    );

    let tokenData = await inceptClient.getTokenData();
    assert.equal(tokenData.collaterals[2].stable.toNumber(), 0);
  });

  it("create address lookup table", async () => {
    const slot = await inceptClient.provider.connection.getSlot("finalized");
    const thisPubKey = inceptClient.provider.publicKey!;
    const [inceptAddress, _] = await inceptClient.getInceptAddress();
    const userInfo = await inceptClient.getUserAddress();
    const userAccount = await inceptClient.getUserAccount();
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];
    const collateral = tokenData.collaterals[0];
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      tokenData.pools[0].assetInfo.iassetMint
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    let lookupTableInst;
    [lookupTableInst, lookupTableAddress] =
      AddressLookupTableProgram.createLookupTable({
        authority: thisPubKey,
        payer: thisPubKey,
        recentSlot: slot,
      });

    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
      payer: thisPubKey,
      authority: thisPubKey,
      lookupTable: lookupTableAddress,
      addresses: [
        anchor.web3.SystemProgram.programId,
        TOKEN_PROGRAM_ID,
        inceptAddress,
        inceptClient.incept!.admin,
        inceptClient.incept!.tokenData,
        inceptClient.incept!.treasuryAddress,
        inceptClient.incept!.usdiMint,
        userInfo.userPubkey,
        userAccount.borrowPositions,
        userAccount.comet,
        userAccount.singlePoolComets,
        userAccount.authority,
        pool.assetInfo.iassetMint,
        pool.iassetTokenAccount,
        pool.usdiTokenAccount,
        pool.liquidityTokenMint,
        pool.cometLiquidityTokenAccount,
        pool.underlyingAssetTokenAccount,
        collateral.mint,
        collateral.vault,
        iassetTokenAccountInfo.address,
        usdiTokenAccountInfo.address,
        mockUSDCTokenAccountInfo.address,
        mockUSDCMint.publicKey,
      ],
    });

    let tx = new Transaction();
    tx.add(lookupTableInst).add(extendInstruction);

    await inceptClient.provider.sendAndConfirm!(tx);

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await inceptClient.provider.sendAndConfirm!(
      new Transaction().add(
        AddressLookupTableProgram.extendLookupTable({
          payer: thisPubKey,
          authority: thisPubKey,
          lookupTable: lookupTableAddress,
          addresses: [
            jupiterAddress,
            jupiterAccount.assetMints[0],
            jupiterAccount.oracles[0],
            jupiterProgram.programId,
          ],
        })
      )
    );
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

    assert(assetInfo.pythAddress.equals(priceFeed), "check price feed");

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

    const mintAmount = 1000000;

    await inceptClient.mintUsdi(
      1000000,
      usdiTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address
    );
    const USDC_SCALE = 7;
    const startingAmount =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -USDC_SCALE);

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );
    const endingAmount =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -USDC_SCALE);

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 100000000,
      mintAmount,
      "check usdi token amount"
    );
    assert.equal(
      startingAmount - endingAmount,
      mintAmount,
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

    await inceptClient.initializeBorrowPosition(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      0,
      1,
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
      new BN(1000000000)
    );

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
      mockUSDCTokenAccountInfo.address
    );
    await inceptClient.addCollateralToSinglePoolComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(25),
      0
    );

    const singlePoolComets = await inceptClient.getSinglePoolComets();

    assert.equal(singlePoolComets.numPositions.toNumber(), 1);
    assert.equal(
      toNumber(singlePoolComets.collaterals[0].collateralAmount),
      25
    );
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
  });

  it("single pool comet liquidity added!", async () => {
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      mockUSDCMint.publicKey
    );

    await inceptClient.addLiquidityToSinglePoolComet(toDevnetScale(510), 0);

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

    const startingUsdiBalance =
      Number(usdiTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);
    const startingIassetBalance =
      Number(iassetTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);

    await inceptClient.withdrawLiquidityFromComet(
      toDevnetScale(100),
      0,
      iassetTokenAccountInfo.address,
      usdiTokenAccountInfo.address,
      true
    );

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    const finalUsdiBalance =
      Number(usdiTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);
    const finalIassetBalance =
      Number(iassetTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);

    assert.isAtLeast(finalUsdiBalance, startingUsdiBalance);
    assert.isAtLeast(finalIassetBalance, startingIassetBalance);

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
    let positionIndex = 0;
    let tokenData = await inceptClient.getTokenData();
    let comet = await inceptClient.getSinglePoolComets();
    let cometPosition = comet.positions[positionIndex];
    const poolIndex = cometPosition.poolIndex;
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

    const startingUSDi = Number(usdiTokenAccountInfo.amount);

    const lookupTableAccount = await inceptClient.provider.connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);

    const recenterInfo = recenterProcedureInstructions(
      inceptClient,
      comet,
      tokenData,
      positionIndex,
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      treasuryUsdiTokenAccount.address,
      treasuryIassetTokenAccount.address
    );

    let tx = await createTx(recenterInfo.ixs);

    const { blockhash } =
      await inceptClient.provider.connection.getLatestBlockhash("finalized");
    let versionedTx = createVersionedTx(
      inceptClient.provider.publicKey!,
      blockhash,
      tx,
      lookupTableAccount!
    );
    await inceptClient.provider.sendAndConfirm!(versionedTx);

    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getSinglePoolComets();
    const cometPosition2 = comet.positions[positionIndex];
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.closeTo(
      fromDevnetNumber(startingUSDi) -
        fromDevnetNumber(usdiTokenAccountInfo.amount),
      recenterInfo.usdiCost,
      1e-7,
      "USDi balance should decrease"
    );
    assert.isBelow(
      toNumber(cometPosition2.borrowedIasset),
      toNumber(cometPosition.borrowedIasset),
      "borrowed iasset should decrease"
    );
    assert.isAbove(
      toNumber(cometPosition2.borrowedUsdi),
      toNumber(cometPosition.borrowedUsdi),
      "USDi borrowed should increase"
    );
    assert.closeTo(
      toNumber(cometPosition2.liquidityTokenValue),
      toNumber(cometPosition.liquidityTokenValue),
      1e-7,
      "lp tokens should stay constant"
    );
  });

  it("single pool comet close out position!", async () => {
    let tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const positionIndex = 1;
    let pool = tokenData.pools[poolIndex];

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
    // Create new single pool w/ USDi
    await inceptClient.initializeSinglePoolComet(poolIndex, 0);
    await inceptClient.addCollateralToSinglePoolComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(100),
      positionIndex
    );
    await inceptClient.addLiquidityToSinglePoolComet(toDevnetScale(200), 1);

    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[poolIndex];
    const prevPrice = toNumber(pool.usdiAmount) / toNumber(pool.iassetAmount);

    let executionEst = calculateExecutionThreshold(15000, false, pool, 0.0001);
    // Decrease pool price
    await inceptClient.sellIasset(
      toDevnetScale(15000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryUsdiTokenAccount.address
    );

    await sleep(2000);
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    let singlePoolComet = (await inceptClient.getSinglePoolComets()).positions[
      positionIndex
    ];
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[poolIndex];

    // Need to withdraw all.
    await inceptClient.withdrawLiquidityFromComet(
      toDevnetScale(10 * toNumber(singlePoolComet.liquidityTokenValue)),
      positionIndex,
      iassetTokenAccountInfo.address,
      usdiTokenAccountInfo.address,
      true
    );

    await inceptClient.payCometILD(
      positionIndex,
      toDevnetScale(toNumber(singlePoolComet.borrowedUsdi)).toNumber(),
      true,
      iassetTokenAccountInfo.address,
      usdiTokenAccountInfo.address,
      true
    );

    await inceptClient.withdrawCollateralAndCloseSinglePoolComet(
      usdiTokenAccountInfo.address,
      positionIndex
    );

    let singlePoolComets = await inceptClient.getSinglePoolComets();
    assert.equal(singlePoolComets.numPositions.toNumber(), 1);

    // Need to buy to get back to original price
    tokenData = await inceptClient.getTokenData();
    const pool3 = tokenData.pools[poolIndex];
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

  // it("single pool comet closed! (liquidity withdrawn, ILD payed, collateral withdrawn, and comet closed)", async () => {
  //   const singlePoolComets = await inceptClient.getSinglePoolComets();
  //   const singlePoolComet = singlePoolComets.positions[0];
  //   let poolIndex = Number(singlePoolComet.poolIndex);
  //   const tokenData = await inceptClient.getTokenData();
  //   const pool = tokenData.pools[poolIndex];

  //   mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     inceptClient.provider,
  //     mockUSDCMint.publicKey
  //   );
  //   usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     inceptClient.provider,
  //     inceptClient.incept!.usdiMint
  //   );
  //   iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     inceptClient.provider,
  //     pool.assetInfo.iassetMint
  //   );
  //   let lpValue = new BN(getMantissa(singlePoolComet.liquidityTokenValue));
  //   await inceptClient.paySinglePoolCometILD(
  //     0,
  //     toNumber(singlePoolComet.borrowedIasset) * 10 ** 8,
  //     false,
  //     iassetTokenAccountInfo.address,
  //     usdiTokenAccountInfo.address,
  //   );
  //   await inceptClient.withdrawLiquidityFromComet(lpValue, 0, iassetTokenAccountInfo.address, usdiTokenAccountInfo.address, true);
  //   await inceptClient.withdrawCollateralAndCloseSinglePoolComet(
  //     usdiTokenAccountInfo.address,
  //     0
  //   );
  // });

  it("comet collateral added!", async () => {
    const collateralToAdd = 100000;
    let comet = await inceptClient.getComet();
    const tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[0];
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    const startingUsdiWallet = fromDevnetNumber(usdiTokenAccountInfo.amount);
    let vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    const startingVaultBalance = vault.value!.uiAmount;

    await inceptClient.addCollateralToComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(collateralToAdd),
      0
    );

    comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    const endingUsdiWallet = fromDevnetNumber(usdiTokenAccountInfo.amount);

    assert.equal(
      startingUsdiWallet - endingUsdiWallet,
      collateralToAdd,
      "check user USDi"
    );

    vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(
      vault.value.uiAmount! - startingVaultBalance!,
      collateralToAdd,
      "check vault balance"
    );

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
    let comet = await inceptClient.getComet();
    let tokenData = await inceptClient.getTokenData();
    const collateral = tokenData.collaterals[0];

    let vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    const startingUsdiWallet = fromDevnetNumber(usdiTokenAccountInfo.amount);
    const collateralToWithdraw = 10000;
    const startingVaultBalance = vault.value.uiAmount!;

    await inceptClient.withdrawCollateralFromComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(collateralToWithdraw),
      0
    );

    vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    comet = await inceptClient.getComet();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    const endingUsdiWallet = fromDevnetNumber(usdiTokenAccountInfo.amount);

    assert.equal(
      endingUsdiWallet - startingUsdiWallet,
      collateralToWithdraw,
      "check user USDi"
    );

    assert.equal(
      startingVaultBalance - vault.value!.uiAmount!,
      collateralToWithdraw,
      "check vault balance"
    );
    assert.equal(comet.numCollaterals.toNumber(), 2, "check num collaterals");
  });

  it("comet liquidity added!", async () => {
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    let tokenData = await inceptClient.getTokenData();
    const initialPool = tokenData.pools[0];
    const liquidityToAdd = 4;

    await inceptClient.addLiquidityToComet(toDevnetScale(liquidityToAdd), 0);

    tokenData = await inceptClient.getTokenData();
    const finalPool = tokenData.pools[0];

    assert.closeTo(
      toNumber(finalPool.usdiAmount) - toNumber(initialPool.usdiAmount),
      liquidityToAdd,
      1e-6,
      "check usdi pool balance"
    );

    assert.isAbove(
      toNumber(finalPool.iassetAmount),
      toNumber(initialPool.iassetAmount),
      "check iasset pool balance"
    );

    assert.isAbove(
      toNumber(finalPool.liquidityTokenSupply),
      toNumber(initialPool.liquidityTokenSupply),
      "check lp supply pool balance"
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

    assert.equal(
      totalILD[0].iAssetILD,
      poolILD[0].iAssetILD,
      "check ILD calculation"
    );
    assert.equal(
      totalILD[0].usdiILD,
      poolILD[0].usdiILD,
      "check ILD calculation"
    );
  });

  it("comet liquidity withdrawn!", async () => {
    const tokenData = await inceptClient.getTokenData();
    let comet = await inceptClient.getComet();
    const positionIndex = 0;
    let position = comet.positions[positionIndex];
    const poolIndex = position.poolIndex;
    const pool = tokenData.pools[poolIndex];
    const withdrawAmount = 10;

    let usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    const startingUsdiAmount = fromDevnetNumber(usdiTokenAccountInfo.amount);
    let iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );
    const startingIassetAmount = fromDevnetNumber(
      iassetTokenAccountInfo.amount
    );
    const startingBorrowedUsdi = toNumber(position.borrowedUsdi);
    const startingBorrowedIasset = toNumber(position.borrowedIasset);

    await inceptClient.withdrawLiquidityFromComet(
      toDevnetScale(withdrawAmount),
      positionIndex,
      iassetTokenAccountInfo.address,
      usdiTokenAccountInfo.address,
      false
    );

    comet = await inceptClient.getComet();
    position = comet.positions[positionIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.isAtLeast(
      fromDevnetNumber(usdiTokenAccountInfo.amount),
      startingUsdiAmount,
      "check usdi user balance"
    );

    assert.isAtLeast(
      fromDevnetNumber(iassetTokenAccountInfo.amount),
      startingIassetAmount,
      "check iasset user balance"
    );
    assert.isBelow(
      toNumber(position.borrowedUsdi),
      startingBorrowedUsdi,
      "borrowed usdi should be lower"
    );
    assert.isBelow(
      toNumber(position.borrowedIasset),
      startingBorrowedIasset,
      "borrowed iasset should be lower"
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

  it("comet recentered!", async () => {
    let positionIndex = 0;
    let tokenData = await inceptClient.getTokenData();
    let comet = await inceptClient.getComet();
    let position = comet.positions[positionIndex];
    let poolIndex = position.poolIndex;
    let pool = tokenData.pools[poolIndex];

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

    treasuryIassetTokenAccount = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint,
      inceptClient.incept!.treasuryAddress,
      true
    );

    const iassetToSell = 2000;

    let executionEst = calculateExecutionThreshold(
      iassetToSell,
      false,
      pool,
      0.0001
    );

    await inceptClient.sellIasset(
      toDevnetScale(iassetToSell),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.usdiThresholdAmount),
      treasuryUsdiTokenAccount.address
    );

    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getComet();
    position = comet.positions[positionIndex];
    poolIndex = position.poolIndex;
    pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    const startingUSDi = fromDevnetNumber(usdiTokenAccountInfo.amount);

    // Recenter position.
    const lookupTableAccount = await inceptClient.provider.connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);

    const recenterInfo = recenterProcedureInstructions(
      inceptClient,
      comet,
      tokenData,
      positionIndex,
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      treasuryUsdiTokenAccount.address,
      treasuryIassetTokenAccount.address
    );

    let tx = await createTx(recenterInfo.ixs);

    const { blockhash } =
      await inceptClient.provider.connection.getLatestBlockhash("finalized");
    let versionedTx = createVersionedTx(
      inceptClient.provider.publicKey!,
      blockhash,
      tx,
      lookupTableAccount!
    );
    await inceptClient.provider.sendAndConfirm!(versionedTx);

    tokenData = await inceptClient.getTokenData();
    comet = await inceptClient.getComet();
    const postPosition = comet.positions[positionIndex];
    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );
    iassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      pool.assetInfo.iassetMint
    );

    assert.closeTo(
      startingUSDi - fromDevnetNumber(usdiTokenAccountInfo.amount),
      recenterInfo.usdiCost,
      1e-7,
      "USDi balance should decrease"
    );
    assert.isAbove(
      toNumber(postPosition.borrowedIasset),
      toNumber(position.borrowedIasset),
      "borrowed iasset should decrease"
    );
    assert.isBelow(
      toNumber(postPosition.borrowedUsdi),
      toNumber(position.borrowedUsdi),
      "USDi borrowed should increase"
    );
    assert.closeTo(
      toNumber(postPosition.liquidityTokenValue),
      toNumber(position.liquidityTokenValue),
      1e-7,
      "lp tokens should stay constant"
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

  it("multipool comet liquidation", async () => {
    let tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
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
    const collateralLeftover = 50;
    const totalUsdiCollateral = toNumber(comet.collaterals[0].collateralAmount);
    const collateralWithdrawn = totalUsdiCollateral - collateralLeftover;

    await inceptClient.withdrawCollateralFromComet(
      usdiTokenAccountInfo.address,
      toDevnetScale(collateralWithdrawn),
      0
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

    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[poolIndex];

    // Set oracle price:
    await setPrice(
      pythProgram,
      toNumber(pool.usdiAmount) / toNumber(pool.iassetAmount),
      pool.assetInfo.pythAddress
    );
    await inceptClient.updatePrices();

    usdiTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      inceptClient.provider,
      inceptClient.incept!.usdiMint
    );

    await inceptClient.program.methods
      .updatePoolParameters(poolIndex, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
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
    assert.equal(comet.collaterals[1].collateralIndex, 2);

    tokenData = await inceptClient.getTokenData();
    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        inceptClient.provider,
        mockAssetMint.publicKey
      );

    let user = await inceptClient.getUserAccount();

    let nonstableCollateralAmount = toNumber(
      comet.collaterals[1].collateralAmount
    );
    let nonstableCollateralIndex = Number(comet.collaterals[1].collateralIndex);
    let collateralPoolIndex =
      tokenData.collaterals[nonstableCollateralIndex].poolIndex.toNumber();
    let nonstableCollateralPrice = toNumber(
      tokenData.pools[collateralPoolIndex].assetInfo.price
    );
    // Update this ixs
    let swapNonstableIx =
      await inceptClient.liquidateCometNonstableCollateralInstruction(
        inceptClient.provider.publicKey!,
        { userPubKey: userAddress.userPubkey, bump: userAddress.bump },
        user,
        comet,
        tokenData,
        toDevnetScale(nonstableCollateralAmount * nonstableCollateralPrice),
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

    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    let healthScore2 = getHealthScore(tokenData, comet);

    assert.equal(
      toNumber(comet.collaterals[1].collateralAmount),
      0,
      "non stable liquidated"
    );

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
    let healthScore3 = getHealthScore(tokenData, comet);

    let { userPubkey, bump } = await inceptClient.getUserAddress();
    let userAccount = await inceptClient.getUserAccount();
    let liquidationIx = await inceptClient.program.methods
      .liquidateCometIld(
        0,
        toDevnetScale(toNumber(comet.positions[0].borrowedIasset)),
        false
      )
      .accounts({
        liquidator: inceptClient.provider.publicKey!,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
        comet: userAccount.comet,
        userAccount: userPubkey,
        user: inceptClient.provider.publicKey!,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidatorUsdiTokenAccount: usdiTokenAccountInfo.address,
        liquidatorIassetTokenAccount: iassetTokenAccountInfo.address,
        usdiMint: inceptClient.incept!.usdiMint,
        usdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await inceptClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(liquidationIx)
    );
    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    let healthScore4 = getHealthScore(tokenData, comet);
    assert.isAbove(
      healthScore4.healthScore,
      healthScore3.healthScore,
      "check liquidation for reducing IL"
    );

    let positionLiquidationIx = await inceptClient.program.methods
      .liquidateCometBorrow(
        0,
        toDevnetScale(toNumber(comet.positions[0].borrowedUsdi))
      )
      .accounts({
        liquidator: inceptClient.provider.publicKey!,
        incept: inceptClient.inceptAddress[0],
        tokenData: inceptClient.incept!.tokenData,
        comet: userAccount.comet,
        userAccount: userPubkey,
        cometLiquidityTokenAccount:
          tokenData.pools[comet.positions[0].poolIndex]
            .cometLiquidityTokenAccount,
        user: inceptClient.provider.publicKey!,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidatorUsdiTokenAccount: usdiTokenAccountInfo.address,
        liquidatorIassetTokenAccount: iassetTokenAccountInfo.address,
        usdiMint: inceptClient.incept!.usdiMint,
        usdiVault: tokenData.collaterals[0].vault,
        liquidityTokenMint:
          tokenData.pools[comet.positions[0].poolIndex].liquidityTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await inceptClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await inceptClient.updatePricesInstruction())
        .add(positionLiquidationIx)
    );

    comet = await inceptClient.getComet();
    tokenData = await inceptClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    let healthScore5 = getHealthScore(tokenData, comet);
    assert.isAbove(
      healthScore5.healthScore,
      healthScore4.healthScore,
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
      toDevnetScale(19000 * toNumber(pool.assetInfo.price) * 1.51),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex,
      collateralIndex
    );

    userMintPositions = await inceptClient.getBorrowPositions();
    position = userMintPositions.borrowPositions[positionIndex];
    let numMintPositions = userMintPositions.numPositions.toNumber();

    let priceThreshold =
      toNumber(position.collateralAmount) /
      (1.5 * toNumber(position.borrowedIasset));

    await setPrice(
      pythProgram,
      priceThreshold * 1.1,
      pool.assetInfo.pythAddress
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

  it("Create second pool", async () => {
    let mockAssetMint2 = anchor.web3.Keypair.generate();
    let price = 1;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    let priceFeed2 = await createPriceFeed(pythProgram, price, expo, conf);
    let currentPrice = (await getFeedData(pythProgram, priceFeed2)).aggregate
      .price;
    assert.equal(currentPrice, price, "check initial price");

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

    await inceptClient.provideUnconcentratedLiquidity(
      toDevnetScale(20000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      1
    );
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
        tokenData: inceptClient.incept!.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

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
    cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

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
      0,
      "collateral amount"
    );

    assert.equal(
      Number(cometManagerUsdiTokenAccount.amount) / 100000000,
      100,
      "Manager usdi balance"
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
    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

    let tx = new Transaction()
      .add(await inceptClient.updatePricesInstruction())
      .add(
        await cometManagerProgram.methods
          .addCollateralToComet(toDevnetScale(100))
          .accounts({
            managerOwner: inceptClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            managerInceptUser: cometManagerInfo.userAccount,
            usdiMint: inceptClient.incept!.usdiMint,
            inceptProgram: inceptClient.programId,
            comet: cometManagerUser.comet,
            tokenData: inceptClient.incept!.tokenData,
            tokenProgram: TOKEN_PROGRAM_ID,
            managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
            inceptUsdiVault: tokenData.collaterals[0].vault,
          })
          .instruction()
      )
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

    let comet = await inceptClient.getComet(cometManagerInfo.userAccount);
    assert.equal(Number(comet.numPositions), 1, "Number positions");
    assert.equal(
      toNumber(comet.positions[0].borrowedUsdi),
      usdiAmount,
      "Usdi position size"
    );
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
    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );
    let cometManagerIassetTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        cometManagerProgram.provider,
        tokenData.pools[poolIndex].assetInfo.iassetMint,
        cometManagerInfoAddress,
        true
      );

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
        managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
        managerIassetTokenAccount: cometManagerIassetTokenAccount.address,
      })
      .rpc();

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
      100,
      "collateral amount"
    );
  });

  it("comet manager redemption!", async () => {
    let usdcMint = jupiterAccount.usdcMint;
    let subscriberUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint
    );
    const subscriberUsdiValue = Number(subscriberUsdiTokenAccount.amount);

    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );
    let cometManagerUsdcTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      usdcMint,
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
    let remainingAccounts: PublicKey[] = [];
    let underlyingMints: PublicKey[] = [];
    let underlyingAccounts: PublicKey[] = [];

    for (
      let poolIndex = 0;
      poolIndex < tokenData.numPools.toNumber();
      poolIndex++
    ) {
      let pool = tokenData.pools[poolIndex];
      let ata = await getOrCreateAssociatedTokenAccount(
        cometManagerProgram.provider,
        pool.assetInfo.iassetMint,
        cometManagerInfoAddress,
        true
      );
      remainingAccounts.push(ata.address);

      let underlying = await getAccount(
        provider.connection,
        pool.underlyingAssetTokenAccount
      );
      underlyingMints.push(underlying.mint);
      let underlyingAta = await getOrCreateAssociatedTokenAccount(
        cometManagerProgram.provider,
        underlying.mint,
        cometManagerInfoAddress,
        true
      );
      underlyingAccounts.push(underlyingAta.address);
    }
    underlyingAccounts.forEach((address) => remainingAccounts.push(address));

    tokenData.pools.slice(0, tokenData.numPools.toNumber()).forEach((pool) => {
      remainingAccounts.push(pool.underlyingAssetTokenAccount);
    });
    underlyingMints.forEach((pk) => remainingAccounts.push(pk));

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
          .updateNetValue()
          .accounts({
            signer: inceptClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            managerInceptUser: cometManagerInfo.userAccount,
            usdiMint: inceptClient.incept!.usdiMint,
            usdcMint: usdcMint,
            comet: cometManagerUser.comet,
            tokenData: inceptClient.incept!.tokenData,
            managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
            managerUsdcTokenAccount: cometManagerUsdcTokenAccount.address,
          })
          .remainingAccounts(
            remainingAccounts.map((pk) => {
              return { pubkey: pk, isSigner: false, isWritable: false };
            })
          )
          .instruction()
      )
      .add(
        await cometManagerProgram.methods
          .withdrawCollateralFromComet(toDevnetScale(100))
          .accounts({
            signer: inceptClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            incept: inceptClient.inceptAddress[0],
            managerInceptUser: cometManagerInfo.userAccount,
            usdiMint: inceptClient.incept!.usdiMint,
            comet: cometManagerUser.comet,
            tokenData: inceptClient.incept!.tokenData,
            managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
            inceptUsdiVault: tokenData.collaterals[0].vault,
            inceptProgram: inceptClient.programId,
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
            tokenData: inceptClient.incept!.tokenData,
            inceptUsdiVault: tokenData.collaterals[0].vault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      );
    const lookupTableAccount = await inceptClient.provider.connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);
    const { blockhash } =
      await inceptClient.provider.connection.getLatestBlockhash("finalized");
    const versionedTx = createVersionedTx(
      inceptProgram.provider.publicKey!,
      blockhash,
      tx,
      lookupTableAccount!
    );
    await inceptClient.provider.sendAndConfirm!(versionedTx);

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
    assert.isAbove(
      Number(subscriberUsdiTokenAccount.amount),
      subscriberUsdiValue,
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
    let iassetMint = tokenData.pools[poolIndex].assetInfo.iassetMint;

    let cometManagerIassetTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        cometManagerProgram.provider,
        iassetMint,
        cometManagerInfoAddress,
        true
      );

    let cometManagerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      inceptClient.incept!.usdiMint,
      cometManagerInfoAddress,
      true
    );

    let ix = await cometManagerProgram.methods
      .payIld(
        positionIndex,
        toDevnetScale(toNumber(comet.positions[positionIndex].borrowedIasset)),
        false
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
        managerUsdiTokenAccount: cometManagerUsdiTokenAccount.address,
        managerIassetTokenAccount: cometManagerIassetTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    let removeCometIx = await cometManagerProgram.methods
      .removeCometPosition(positionIndex)
      .accounts({
        signer: inceptClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptClient.inceptAddress[0],
        managerInceptUser: cometManagerInfo.userAccount,
        inceptProgram: inceptClient.programId,
        comet: cometManagerUser.comet,
        tokenData: inceptClient.incept!.tokenData,
      })
      .instruction();

    let tx = new Transaction().add(removeCometIx);

    await inceptClient.provider.sendAndConfirm!(tx);

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
