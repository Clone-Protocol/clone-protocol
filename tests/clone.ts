import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Clone } from "../sdk/src/idl/clone";
import { Pyth } from "../sdk/src/idl/pyth";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";
import { CloneCometManager } from "../sdk/src/idl/clone_comet_manager";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  DEVNET_TOKEN_SCALE,
  CloneClient,
  toDevnetScale,
} from "../sdk/src/clone";
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
  calculateEditCometSinglePoolWithOnusdBorrowed,
  getSinglePoolHealthScore,
  getHealthScore,
  getEffectiveUSDCollateralValue,
  calculateCometRecenterSinglePool,
  calculateCometRecenterMultiPool,
  getILD,
} from "../sdk/src/healthscore";
// import { Clone as CloneInfo } from "../sdk/src/interfaces";
import { ManagerInfo, Subscriber } from "../sdk/src/comet_manager";

describe("clone", async () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  let cloneProgram = anchor.workspace.Clone as Program<Clone>;
  let pythProgram = anchor.workspace.Pyth as Program<Pyth>;
  let walletPubkey = cloneProgram.provider.publicKey!;
  let jupiterProgram = anchor.workspace
    .JupiterAggMock as Program<JupiterAggMock>;

  let cometManagerProgram = anchor.workspace
    .CloneCometManager as Program<CloneCometManager>;

  const mockUSDCMint = anchor.web3.Keypair.generate();
  const treasuryAddress = anchor.web3.Keypair.generate();
  let treasuryOnusdTokenAccount;
  let treasuryOnassetTokenAccount;

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
  let onusdTokenAccountInfo;
  let onassetTokenAccountInfo;
  let liquidityTokenAccountInfo;
  let cloneClient = new CloneClient(cloneProgram.programId, provider);
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
    await cloneClient.initializeClone(
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
    tx.add(await cloneClient.initializeUserInstruction());

    const borrowAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await cloneClient.initializeBorrowPositionsAccountInstruction(
        borrowAccountKeypair
      )
    );

    const cometAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await cloneClient.initializeCometInstruction(cometAccountKeypair, false)
    );

    const singlePoolCometAccountKeypair = anchor.web3.Keypair.generate();
    tx.add(
      await cloneClient.initializeCometInstruction(
        singlePoolCometAccountKeypair,
        true
      )
    );

    await cloneClient.provider.sendAndConfirm!(tx, [
      borrowAccountKeypair,
      cometAccountKeypair,
      singlePoolCometAccountKeypair,
    ]);

    let userAccountData = await cloneClient.getUserAccount();

    assert(
      userAccountData.authority.equals(cloneClient.provider.publicKey!),
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

  it("pool initialized!", async () => {
    const jupiterData = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await cloneClient.initializePool(
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

    let tokenData = await cloneClient.getTokenData();
    assert.equal(tokenData.numPools.toNumber(), 1);
  });

  it("non-stable mock asset added as a collateral!", async () => {
    await cloneClient.addCollateral(
      walletPubkey,
      8,
      false,
      mockAssetMint.publicKey,
      200,
      0
    );

    let tokenData = await cloneClient.getTokenData();
    assert.equal(tokenData.collaterals[2].stable.toNumber(), 0);
  });

  // it("temp step: initialize liquidity:", async () => {
  //   await cloneClient.initializeSinglePoolComet(0, 0);

  //   mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     cloneClient.provider,
  //     mockUSDCMint.publicKey
  //   );
  //   onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     cloneClient.provider,
  //     cloneClient.clone!.onusdMint,
  //   );
  //   await cloneClient.hackathonMintOnusd(
  //     onusdTokenAccountInfo.address,
  //     toDevnetScale(2000),
  //   );
  //   await cloneClient.addCollateralToSinglePoolComet(
  //     onusdTokenAccountInfo.address,
  //     toDevnetScale(2000),
  //     0
  //   );

  //   await cloneClient.addLiquidityToSinglePoolComet(toDevnetScale(10000), 0);
  // })

  it("create address lookup table", async () => {
    const slot = await cloneClient.provider.connection.getSlot("finalized");
    const thisPubKey = cloneClient.provider.publicKey!;
    const [cloneAddress, _] = await cloneClient.getCloneAddress();
    const userInfo = await cloneClient.getUserAddress();
    const userAccount = await cloneClient.getUserAccount();
    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[0];
    const collateral = tokenData.collaterals[0];
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      tokenData.pools[0].assetInfo.onassetMint
    );
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
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
        cloneAddress,
        cloneClient.clone!.admin,
        cloneClient.clone!.tokenData,
        cloneClient.clone!.treasuryAddress,
        cloneClient.clone!.onusdMint,
        userInfo.userPubkey,
        userAccount.borrowPositions,
        userAccount.comet,
        userAccount.singlePoolComets,
        userAccount.authority,
        pool.assetInfo.onassetMint,
        pool.onassetTokenAccount,
        pool.onusdTokenAccount,
        pool.liquidityTokenMint,
        pool.cometLiquidityTokenAccount,
        pool.underlyingAssetTokenAccount,
        collateral.mint,
        collateral.vault,
        onassetTokenAccountInfo.address,
        onusdTokenAccountInfo.address,
        mockUSDCTokenAccountInfo.address,
        mockUSDCMint.publicKey,
      ],
    });

    let tx = new Transaction();
    tx.add(lookupTableInst).add(extendInstruction);

    await cloneClient.provider.sendAndConfirm!(tx);

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await cloneClient.provider.sendAndConfirm!(
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
    const tokenData = await cloneClient.getTokenData();

    assert(
      tokenData.clone.equals(cloneClient.cloneAddress[0]),
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
      !first_pool.onassetTokenAccount.equals(anchor.web3.PublicKey.default),
      "check onassetTokenAccount"
    );
    assert(
      !first_pool.onusdTokenAccount.equals(anchor.web3.PublicKey.default),
      "check onusdTokenAccount"
    );
    assert(
      !first_pool.liquidityTokenMint.equals(anchor.web3.PublicKey.default),
      "check liquidityTokenMint"
    );
    assert(
      !first_pool.underlyingAssetTokenAccount.equals(
        anchor.web3.PublicKey.default
      ),
      "check onassetTokenAccount"
    );
    assert(
      !first_pool.cometLiquidityTokenAccount.equals(
        anchor.web3.PublicKey.default
      ),
      "check onassetTokenAccount"
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
    await cloneClient.updatePrices(undefined, signers);
  });

  it("mock usdc minted!", async () => {
    const usdcMintAmount = new BN("10000000000000000");
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
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
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      1000000000,
      "check USDC amount"
    );
  });

  it("onusd minted!", async () => {
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    const mintAmount = 1000000;
    const USDC_SCALE = 7;
    await cloneClient.mintOnusd(
      mintAmount,
      onusdTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address
    );
    const startingAmount =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -USDC_SCALE);

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    const endingAmount =
      Number(mockUSDCTokenAccountInfo.amount) * Math.pow(10, -USDC_SCALE);

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      mintAmount,
      "check onusd token amount"
    );
    assert.equal(
      startingAmount - endingAmount,
      mintAmount,
      "check USDC amount"
    );

    const tokenData = await cloneClient.getTokenData();

    const vault = await cloneClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 1000000, "check usdc vault amount");
  });

  it("mint mock asset", async () => {
    let assetMintAmount = 1000;

    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
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
      cloneClient.provider,
      mockAssetMint.publicKey
    );

    assert.equal(
      Number(mockAssetAssociatedTokenAddress.amount) / 100000000,
      assetMintAmount
    );
  });

  it("onasset minted!", async () => {
    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[0];

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await cloneClient.initializeBorrowPosition(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0,
      1,
      signers
    );

    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[0];

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check onasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      979000000,
      "check USDC amount"
    );

    let vault = await cloneClient.connection.getTokenAccountBalance(
      tokenData.collaterals[1].vault,
      "recent"
    );
    assert.equal(vault.value!.uiAmount, 21000000, "check usdc vault amount");

    const mintPosition = (await cloneClient.getBorrowPositions())
      .borrowPositions[0];

    assert.equal(
      toNumber(mintPosition.borrowedOnasset),
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
    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[0];

    await cloneClient.closeBorrowPosition(
      onassetTokenAccountInfo.address,
      0,
      mockUSDCTokenAccountInfo.address,
      signers
    );

    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[0];

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 1000000000000,
      0,
      "check onasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999000000,
      "check USDC amount"
    );

    const vault = await cloneClient.connection.getTokenAccountBalance(
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
    await cloneClient.initializeBorrowPosition(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0,
      1,
      signers
    );
  });

  it("mint collateral added!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    await cloneClient.addCollateralToBorrow(
      0,
      mockUSDCTokenAccountInfo.address,
      new BN(1000000000),
      signers
    );

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[0];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check onasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      978999900,
      "check USDC amount"
    );

    const vault = await cloneClient.connection.getTokenAccountBalance(
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
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    await cloneClient.withdrawCollateralFromBorrow(
      mockUSDCTokenAccountInfo.address,
      0,
      new BN(1000000000)
    );

    const tokenData = await cloneClient.getTokenData();

    const pool = tokenData.pools[0];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check onasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      979000000,
      "check USDC amount"
    );

    const vault = await cloneClient.connection.getTokenAccountBalance(
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

  it("onasset burned!", async () => {
    const tokenData = await cloneClient.getTokenData();

    const pool = tokenData.pools[0];
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    let userAccountData = await cloneClient.getUserAccount();
    let userAddress = await cloneClient.getUserAddress();
    let assetInfo = tokenData.pools[0].assetInfo;

    await cloneProgram.methods
      .payBorrowDebt(0, new BN(5000000))
      .accounts({
        user: walletPubkey,
        userAccount: userAddress.userPubkey,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
        userOnassetTokenAccount: onassetTokenAccountInfo.address,
        borrowPositions: userAccountData.borrowPositions,
        onassetMint: assetInfo.onassetMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      199999.95,
      "check user onasset balance."
    );
  });

  it("onasset reminted!", async () => {
    const tokenData = await cloneClient.getTokenData();

    const pool = tokenData.pools[0];
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    await cloneClient.borrowMore(
      onassetTokenAccountInfo.address,
      new BN(5000000),
      0,
      []
    );

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      200000,
      "check user onasset balance"
    );
  });

  it("liquidity position initialized!", async () => {
    const tokenData = await cloneClient.getTokenData();

    const pool = tokenData.pools[0];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    await cloneClient.provideUnconcentratedLiquidity(
      toDevnetScale(100000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      0
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      500000,
      "check onusd"
    );
    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      100000,
      "check onasset"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 100000000,
      5000000,
      "check liquidity tokens"
    );

    const onusdAccountBalance =
      await cloneClient.connection.getTokenAccountBalance(
        pool.onusdTokenAccount,
        "recent"
      );
    assert.equal(
      onusdAccountBalance.value!.uiAmount,
      500000,
      "check onusd account balance"
    );

    const onassetAccountBalance =
      await cloneClient.connection.getTokenAccountBalance(
        pool.onassetTokenAccount,
        "recent"
      );
    assert.equal(
      onassetAccountBalance.value!.uiAmount,
      100000,
      "check onasset account balance"
    );
  });

  it("liquidity provided!", async () => {
    const tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    let pool = tokenData.pools[poolIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    await cloneClient.provideUnconcentratedLiquidity(
      toDevnetScale(1),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      poolIndex
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      499995,
      "check user onusd balance"
    );
    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      99999,
      "check user onAsset balance"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 100000000,
      5000049.9995,
      "check liquidity token balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onusdTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      500005,
      "check onUSD pool balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      100001,
      "check onAsset pool balance"
    );
  });

  it("liquidity withdrawn!", async () => {
    const tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    await cloneClient.withdrawUnconcentratedLiquidity(
      new BN(45453545454500),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      poolIndex
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      545448.54545904,
      "check user onusd balance"
    );
    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      109089.7090918,
      "check user onAsset balance"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 100000000,
      4545514.544955,
      "check user liquidity token balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onusdTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      454551.45454096,
      "check pool onusd balance."
    );

    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      90910.2909082,
      "check pool onAsset balance."
    );
  });

  it("onasset bought!", async () => {
    let tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];
    const purchaseAmount = 10000;

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    const executionEst = calculateExecutionThreshold(
      purchaseAmount,
      true,
      pool,
      0.0001
    );

    const treasuryOnassetAssociatedTokenAddress =
      await getAssociatedTokenAddress(
        pool.assetInfo.onassetMint,
        treasuryAddress.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    const treasuryOnusdAssociatedTokenAddress = await getAssociatedTokenAddress(
      cloneClient.clone!.onusdMint,
      treasuryAddress.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    await cloneClient.provider.sendAndConfirm!(
      new Transaction()
        .add(
          await createAssociatedTokenAccountInstruction(
            cloneClient.provider.publicKey!,
            treasuryOnassetAssociatedTokenAddress,
            treasuryAddress.publicKey,
            pool.assetInfo.onassetMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
        .add(
          await createAssociatedTokenAccountInstruction(
            cloneClient.provider.publicKey!,
            treasuryOnusdAssociatedTokenAddress,
            treasuryAddress.publicKey,
            cloneClient.clone!.onusdMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
    );
    treasuryOnassetTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnassetAssociatedTokenAddress,
      "recent"
    );
    treasuryOnusdTokenAccount = await getAccount(
      cloneClient.provider.connection,
      treasuryOnusdAssociatedTokenAddress,
      "recent"
    );

    await cloneClient.buyOnasset(
      toDevnetScale(purchaseAmount),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnassetTokenAccount.address
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      487309.10873496,
      "check user onusd balance"
    );
    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      119089.7090918,
      "check user onAsset balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onusdTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      512690.89126504,
      "check pool onusd balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      80807.1981247,
      "check pool onAsset balance"
    );

    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            treasuryOnassetTokenAccount.address,
            "recent"
          )
        ).value!.uiAmount
      ),
      103.0927835,
      "check treasury onAsset balance"
    );
  });

  it("onasset sold!", async () => {
    const tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    let executionEst = calculateExecutionThreshold(10000, false, pool, 0.0001);

    await cloneClient.sellOnasset(
      new BN(1000000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      new BN(executionEst.onusdThresholdAmount),
      treasuryOnusdTokenAccount.address
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      542074.6091355,
      "check user onusd balance"
    );
    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      109089.7090918,
      "check user onAsset balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onusdTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      457360.79807687,
      "check pool onusd balance"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      90807.1981247,
      "check pool onAsset balance"
    );
  });

  it("single pool comet initialized!", async () => {
    await cloneClient.initializeSinglePoolComet(0, 0);

    const singlePoolComets = await cloneClient.getSinglePoolComets();

    assert.equal(
      Number(singlePoolComets.numPositions),
      1,
      "ensure comet position was initialized"
    );
  });

  it("single pool comet collateral added!", async () => {
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    await cloneClient.mintOnusd(
      25,
      onusdTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address
    );
    await cloneClient.addCollateralToSinglePoolComet(
      onusdTokenAccountInfo.address,
      toDevnetScale(25),
      0
    );

    const singlePoolComets = await cloneClient.getSinglePoolComets();

    assert.equal(singlePoolComets.numPositions.toNumber(), 1);
    assert.equal(
      toNumber(singlePoolComets.collaterals[0].collateralAmount),
      25
    );
  });

  it("single pool comet collateral withdrawn!", async () => {
    let comet = await cloneClient.getSinglePoolComets();
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    let tokenData = await cloneClient.getTokenData();

    // Estimate using edit.
    const estimation = calculateEditCometSinglePoolWithOnusdBorrowed(
      tokenData,
      comet,
      0,
      -5,
      0
    );

    await cloneClient.withdrawCollateralFromSinglePoolComet(
      onusdTokenAccountInfo.address,
      new BN(50000000),
      0
    );

    const health = await getSinglePoolHealthScore(0, tokenData, comet);

    assert.closeTo(estimation.healthScore, health.healthScore, 0.01);
  });

  it("single pool comet liquidity added!", async () => {
    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );

    await cloneClient.addLiquidityToSinglePoolComet(toDevnetScale(510), 0);

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[0];

    const onusdAccountBalance =
      await cloneClient.connection.getTokenAccountBalance(
        pool.onusdTokenAccount,
        "recent"
      );

    assert.equal(
      onusdAccountBalance.value!.uiAmount,
      457870.79807687,
      "check onusd pool balance"
    );

    const onassetTokenBalance =
      await cloneClient.connection.getTokenAccountBalance(
        pool.onassetTokenAccount,
        "recent"
      );

    assert.equal(
      onassetTokenBalance.value!.uiAmount,
      90908.45663054,
      "check onasset pool balance"
    );
  });

  it("single pool comet liquidity subtracted!", async () => {
    let poolIndex = 0;
    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const comet = await cloneClient.getSinglePoolComets();

    const startingOnusdBalance =
      Number(onusdTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);
    const startingOnassetBalance =
      Number(onassetTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);

    await cloneClient.withdrawLiquidityFromComet(
      toDevnetScale(100),
      0,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address,
      true
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    const finalOnusdBalance =
      Number(onusdTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);
    const finalOnassetBalance =
      Number(onassetTokenAccountInfo.amount) * Math.pow(10, -DEVNET_TOKEN_SCALE);

    assert.isAtLeast(finalOnusdBalance, startingOnusdBalance);
    assert.isAtLeast(finalOnassetBalance, startingOnassetBalance);

    const onusdAccountBalance =
      await cloneClient.connection.getTokenAccountBalance(
        pool.onusdTokenAccount,
        "recent"
      );

    assert.equal(
      onusdAccountBalance.value!.uiAmount,
      457860.73627213,
      "check onusd pool balance"
    );

    const onassetTokenBalance =
      await cloneClient.connection.getTokenAccountBalance(
        pool.onassetTokenAccount,
        "recent"
      );

    assert.equal(
      onassetTokenBalance.value!.uiAmount,
      90906.45889856,
      "check onasset pool balance"
    );
  });

  it("onasset bought!", async () => {
    let poolIndex = 0;
    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[poolIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const executionEst = calculateExecutionThreshold(10000, true, pool, 0.0001);

    await cloneClient.buyOnasset(
      new BN(1000000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnassetTokenAccount.address
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      483509.61411564,
      "check user onusd balance."
    );
    assert.equal(
      Number(onassetTokenAccountInfo.amount) / 100000000,
      119089.7090918,
      "check user onAsset balance."
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onusdTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      516426.23129199,
      "check pool onusd"
    );
    assert.equal(
      Number(
        (
          await cloneClient.connection.getTokenAccountBalance(
            pool.onassetTokenAccount,
            "recent"
          )
        ).value!.uiAmount
      ),
      80803.36611506,
      "check pool onAsset"
    );
  });

  it("single pool comet recentered!", async () => {
    let positionIndex = 0;
    let tokenData = await cloneClient.getTokenData();
    let comet = await cloneClient.getSinglePoolComets();
    let cometPosition = comet.positions[positionIndex];
    const poolIndex = cometPosition.poolIndex;
    const pool = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    const startingOnUSD = Number(onusdTokenAccountInfo.amount);

    const lookupTableAccount = await cloneClient.provider.connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);

    const recenterInfo = recenterProcedureInstructions(
      cloneClient,
      comet,
      tokenData,
      positionIndex,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    let tx = await createTx(recenterInfo.ixs);

    const { blockhash } =
      await cloneClient.provider.connection.getLatestBlockhash("finalized");
    let versionedTx = createVersionedTx(
      cloneClient.provider.publicKey!,
      blockhash,
      tx,
      lookupTableAccount!
    );
    await cloneClient.provider.sendAndConfirm!(versionedTx);

    tokenData = await cloneClient.getTokenData();
    comet = await cloneClient.getSinglePoolComets();
    const cometPosition2 = comet.positions[positionIndex];
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      fromDevnetNumber(startingOnUSD) -
        fromDevnetNumber(onusdTokenAccountInfo.amount),
      recenterInfo.onusdCost,
      1e-7,
      "onUSD balance should decrease"
    );
    assert.isBelow(
      toNumber(cometPosition2.borrowedOnasset),
      toNumber(cometPosition.borrowedOnasset),
      "borrowed onasset should decrease"
    );
    assert.isAbove(
      toNumber(cometPosition2.borrowedOnusd),
      toNumber(cometPosition.borrowedOnusd),
      "onUSD borrowed should increase"
    );
    assert.closeTo(
      toNumber(cometPosition2.liquidityTokenValue),
      toNumber(cometPosition.liquidityTokenValue),
      1e-7,
      "lp tokens should stay constant"
    );
  });

  it("single pool comet close out position!", async () => {
    let tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    const positionIndex = 1;
    let pool = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    // Create new single pool w/ onUSD
    await cloneClient.initializeSinglePoolComet(poolIndex, 0);
    await cloneClient.addCollateralToSinglePoolComet(
      onusdTokenAccountInfo.address,
      toDevnetScale(100),
      positionIndex
    );
    await cloneClient.addLiquidityToSinglePoolComet(toDevnetScale(200), 1);

    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[poolIndex];
    const prevPrice = toNumber(pool.onusdAmount) / toNumber(pool.onassetAmount);

    let executionEst = calculateExecutionThreshold(15000, false, pool, 0.0001);
    // Decrease pool price
    await cloneClient.sellOnasset(
      toDevnetScale(15000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnusdTokenAccount.address
    );

    await sleep(2000);
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    let singlePoolComet = (await cloneClient.getSinglePoolComets()).positions[
      positionIndex
    ];
    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[poolIndex];

    // Need to withdraw all.
    await cloneClient.withdrawLiquidityFromComet(
      toDevnetScale(10 * toNumber(singlePoolComet.liquidityTokenValue)),
      positionIndex,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address,
      true
    );

    await cloneClient.payCometILD(
      positionIndex,
      toDevnetScale(toNumber(singlePoolComet.borrowedOnusd)).toNumber(),
      true,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address,
      true
    );

    await cloneClient.withdrawCollateralAndCloseSinglePoolComet(
      onusdTokenAccountInfo.address,
      positionIndex
    );

    let singlePoolComets = await cloneClient.getSinglePoolComets();
    assert.equal(singlePoolComets.numPositions.toNumber(), 1);

    // Need to buy to get back to original price
    tokenData = await cloneClient.getTokenData();
    const pool3 = tokenData.pools[poolIndex];
    const onAssetToBuy =
      toNumber(pool3.onassetAmount) -
      Math.sqrt(
        (toNumber(pool3.onusdAmount) * toNumber(pool3.onassetAmount)) / prevPrice
      );
    executionEst = calculateExecutionThreshold(onAssetToBuy, true, pool3, 0.002);

    await cloneClient.buyOnasset(
      toDevnetScale(onAssetToBuy),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnassetTokenAccount.address
    );
  });

  // it("single pool comet closed! (liquidity withdrawn, ILD payed, collateral withdrawn, and comet closed)", async () => {
  //   const singlePoolComets = await cloneClient.getSinglePoolComets();
  //   const singlePoolComet = singlePoolComets.positions[0];
  //   let poolIndex = Number(singlePoolComet.poolIndex);
  //   const tokenData = await cloneClient.getTokenData();
  //   const pool = tokenData.pools[poolIndex];

  //   mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     cloneClient.provider,
  //     mockUSDCMint.publicKey
  //   );
  //   onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     cloneClient.provider,
  //     cloneClient.clone!.onusdMint
  //   );
  //   onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //     cloneClient.provider,
  //     pool.assetInfo.onassetMint
  //   );
  //   let lpValue = new BN(getMantissa(singlePoolComet.liquidityTokenValue));
  //   await cloneClient.paySinglePoolCometILD(
  //     0,
  //     toNumber(singlePoolComet.borrowedOnasset) * 10 ** 8,
  //     false,
  //     onassetTokenAccountInfo.address,
  //     onusdTokenAccountInfo.address,
  //   );
  //   await cloneClient.withdrawLiquidityFromComet(lpValue, 0, onassetTokenAccountInfo.address, onusdTokenAccountInfo.address, true);
  //   await cloneClient.withdrawCollateralAndCloseSinglePoolComet(
  //     onusdTokenAccountInfo.address,
  //     0
  //   );
  // });

  it("comet collateral added!", async () => {
    const collateralToAdd = 100000;
    let comet = await cloneClient.getComet();
    const tokenData = await cloneClient.getTokenData();
    const collateral = tokenData.collaterals[0];
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    const startingOnusdWallet = fromDevnetNumber(onusdTokenAccountInfo.amount);
    let vault = await cloneClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    const startingVaultBalance = vault.value!.uiAmount;

    await cloneClient.addCollateralToComet(
      onusdTokenAccountInfo.address,
      toDevnetScale(collateralToAdd),
      0
    );

    comet = await cloneClient.getComet();

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const endingOnusdWallet = fromDevnetNumber(onusdTokenAccountInfo.amount);

    assert.equal(
      startingOnusdWallet - endingOnusdWallet,
      collateralToAdd,
      "check user onUSD"
    );

    vault = await cloneClient.connection.getTokenAccountBalance(
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
        cloneClient.provider,
        mockAssetMint.publicKey
      );

    const nonStableCollateral = tokenData.collaterals[2];

    // Add non-stable collateral
    await cloneClient.addCollateralToComet(
      mockAssetAssociatedTokenAddress.address,
      toDevnetScale(100),
      2
    );

    const nonStableVault = await cloneClient.connection.getTokenAccountBalance(
      nonStableCollateral.vault,
      "recent"
    );

    assert.equal(
      nonStableVault.value!.uiAmount,
      100,
      "check non-stable vault balance"
    );

    comet = await cloneClient.getComet();

    assert.equal(comet.numCollaterals.toNumber(), 2, "check num collaterals");
  });

  it("comet collateral withdrawn!", async () => {
    let comet = await cloneClient.getComet();
    let tokenData = await cloneClient.getTokenData();
    const collateral = tokenData.collaterals[0];

    let vault = await cloneClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const startingOnusdWallet = fromDevnetNumber(onusdTokenAccountInfo.amount);
    const collateralToWithdraw = 10000;
    const startingVaultBalance = vault.value.uiAmount!;

    await cloneClient.withdrawCollateralFromComet(
      onusdTokenAccountInfo.address,
      toDevnetScale(collateralToWithdraw),
      0
    );

    vault = await cloneClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    comet = await cloneClient.getComet();

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const endingOnusdWallet = fromDevnetNumber(onusdTokenAccountInfo.amount);

    assert.equal(
      endingOnusdWallet - startingOnusdWallet,
      collateralToWithdraw,
      "check user onUSD"
    );

    assert.equal(
      startingVaultBalance - vault.value!.uiAmount!,
      collateralToWithdraw,
      "check vault balance"
    );
    assert.equal(comet.numCollaterals.toNumber(), 2, "check num collaterals");
  });

  it("comet liquidity added!", async () => {
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    let tokenData = await cloneClient.getTokenData();
    const initialPool = tokenData.pools[0];
    const liquidityToAdd = 4;

    await cloneClient.addLiquidityToComet(toDevnetScale(liquidityToAdd), 0);

    tokenData = await cloneClient.getTokenData();
    const finalPool = tokenData.pools[0];

    assert.closeTo(
      toNumber(finalPool.onusdAmount) - toNumber(initialPool.onusdAmount),
      liquidityToAdd,
      1e-6,
      "check onusd pool balance"
    );

    assert.isAbove(
      toNumber(finalPool.onassetAmount),
      toNumber(initialPool.onassetAmount),
      "check onasset pool balance"
    );

    assert.isAbove(
      toNumber(finalPool.liquidityTokenSupply),
      toNumber(initialPool.liquidityTokenSupply),
      "check lp supply pool balance"
    );
  });

  it("comet health check", async () => {
    let comet = await cloneClient.getComet();
    let tokenData = await cloneClient.getTokenData();
    let healthScore = getHealthScore(tokenData, comet);

    assert.closeTo(
      healthScore.healthScore,
      99.99995293331263,
      1e-4,
      "check health score."
    );
    await cloneClient.program.methods
      .updatePoolParameters(0, {
        positionHealthScoreCoefficient: {
          value: convertToRawDecimal(healthScoreCoefficient * 2),
        },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    // await cloneClient.program.methods
    //   .updatePoolParameters(0, {
    //     healthScoreCoefficient: {
    //       value: convertToRawDecimal(healthScoreCoefficient * 2),
    //     },
    //   })
    //   .accounts({
    //     admin: cloneClient.clone!.admin,
    //     clone: cloneClient.cloneAddress[0],
    //     tokenData: cloneClient.clone!.tokenData,
    //   })
    //   .rpc();

    await cloneClient.program.methods
      .updatePoolParameters(0, {
        ilHealthScoreCoefficient: {
          value: convertToRawDecimal(ilHealthScoreCoefficient * 2),
        },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    comet = await cloneClient.getComet();
    tokenData = await cloneClient.getTokenData();

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
      totalILD[0].onAssetILD,
      poolILD[0].onAssetILD,
      "check ILD calculation"
    );
    assert.equal(
      totalILD[0].onusdILD,
      poolILD[0].onusdILD,
      "check ILD calculation"
    );
  });

  it("comet liquidity withdrawn!", async () => {
    const tokenData = await cloneClient.getTokenData();
    let comet = await cloneClient.getComet();
    const positionIndex = 0;
    let position = comet.positions[positionIndex];
    const poolIndex = position.poolIndex;
    const pool = tokenData.pools[poolIndex];
    const withdrawAmount = 10;

    let onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const startingOnusdAmount = fromDevnetNumber(onusdTokenAccountInfo.amount);
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const startingOnassetAmount = fromDevnetNumber(
      onassetTokenAccountInfo.amount
    );
    const startingBorrowedOnusd = toNumber(position.borrowedOnusd);
    const startingBorrowedOnasset = toNumber(position.borrowedOnasset);

    await cloneClient.withdrawLiquidityFromComet(
      toDevnetScale(withdrawAmount),
      positionIndex,
      onassetTokenAccountInfo.address,
      onusdTokenAccountInfo.address,
      false
    );

    comet = await cloneClient.getComet();
    position = comet.positions[positionIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.isAtLeast(
      fromDevnetNumber(onusdTokenAccountInfo.amount),
      startingOnusdAmount,
      "check onusd user balance"
    );

    assert.isAtLeast(
      fromDevnetNumber(onassetTokenAccountInfo.amount),
      startingOnassetAmount,
      "check onasset user balance"
    );
    assert.isBelow(
      toNumber(position.borrowedOnusd),
      startingBorrowedOnusd,
      "borrowed onusd should be lower"
    );
    assert.isBelow(
      toNumber(position.borrowedOnasset),
      startingBorrowedOnasset,
      "borrowed onasset should be lower"
    );
  });

  it("devnet onUSD mint", async () => {
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    const currentOnUSD = Number(onusdTokenAccountInfo.amount) / 100000000;

    await cloneClient.devnetMintOnusd(
      onusdTokenAccountInfo.address,
      500000000000000
    );

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    assert.equal(
      Number(onusdTokenAccountInfo.amount) / 100000000,
      currentOnUSD + 5000000,
      "onusd not minted properly!"
    );
  });

  it("comet recentered!", async () => {
    let positionIndex = 0;
    let tokenData = await cloneClient.getTokenData();
    let comet = await cloneClient.getComet();
    let position = comet.positions[positionIndex];
    let poolIndex = position.poolIndex;
    let pool = tokenData.pools[poolIndex];

    mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      mockUSDCMint.publicKey
    );
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    treasuryOnassetTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint,
      cloneClient.clone!.treasuryAddress,
      true
    );

    const onassetToSell = 2000;

    let executionEst = calculateExecutionThreshold(
      onassetToSell,
      false,
      pool,
      0.0001
    );

    await cloneClient.sellOnasset(
      toDevnetScale(onassetToSell),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnusdTokenAccount.address
    );

    tokenData = await cloneClient.getTokenData();
    comet = await cloneClient.getComet();
    position = comet.positions[positionIndex];
    poolIndex = position.poolIndex;
    pool = tokenData.pools[poolIndex];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    const startingOnUSD = fromDevnetNumber(onusdTokenAccountInfo.amount);

    // Recenter position.
    const lookupTableAccount = await cloneClient.provider.connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);

    const recenterInfo = recenterProcedureInstructions(
      cloneClient,
      comet,
      tokenData,
      positionIndex,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      treasuryOnusdTokenAccount.address,
      treasuryOnassetTokenAccount.address
    );

    let tx = await createTx(recenterInfo.ixs);

    const { blockhash } =
      await cloneClient.provider.connection.getLatestBlockhash("finalized");
    let versionedTx = createVersionedTx(
      cloneClient.provider.publicKey!,
      blockhash,
      tx,
      lookupTableAccount!
    );
    await cloneClient.provider.sendAndConfirm!(versionedTx);

    tokenData = await cloneClient.getTokenData();
    comet = await cloneClient.getComet();
    const postPosition = comet.positions[positionIndex];
    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );
    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.closeTo(
      startingOnUSD - fromDevnetNumber(onusdTokenAccountInfo.amount),
      recenterInfo.onusdCost,
      1e-7,
      "onUSD balance should decrease"
    );
    assert.isAbove(
      toNumber(postPosition.borrowedOnasset),
      toNumber(position.borrowedOnasset),
      "borrowed onasset should decrease"
    );
    assert.isBelow(
      toNumber(postPosition.borrowedOnusd),
      toNumber(position.borrowedOnusd),
      "onUSD borrowed should increase"
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
      cloneProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      jupiterAccount.usdcMint,
      cloneProgram.provider.publicKey!,
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
    let tokenData = await cloneClient.getTokenData();
    const poolIndex = 0;
    let pool = tokenData.pools[poolIndex];
    let comet = await cloneClient.getComet();

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    const collateralLeftover = 50;
    const totalOnusdCollateral = toNumber(comet.collaterals[0].collateralAmount);
    const collateralWithdrawn = totalOnusdCollateral - collateralLeftover;

    await cloneClient.withdrawCollateralFromComet(
      onusdTokenAccountInfo.address,
      toDevnetScale(collateralWithdrawn),
      0
    );
    let buyAmount = toDevnetScale(29998);

    let executionEst = calculateExecutionThreshold(29998, true, pool, 0.0001);

    await cloneClient.buyOnasset(
      buyAmount,
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      toDevnetScale(executionEst.onusdThresholdAmount),
      treasuryOnassetTokenAccount.address
    );

    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[poolIndex];

    // Set oracle price:
    await setPrice(
      pythProgram,
      toNumber(pool.onusdAmount) / toNumber(pool.onassetAmount),
      pool.assetInfo.pythAddress
    );
    await cloneClient.updatePrices();

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    await cloneClient.program.methods
      .updatePoolParameters(poolIndex, {
        positionHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    await cloneClient.program.methods
      .updatePoolParameters(poolIndex, {
        ilHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    // Check that the score is zero.
    comet = await cloneClient.getComet();
    tokenData = await cloneClient.getTokenData();
    let healthScore1 = getHealthScore(tokenData, comet);

    assert.isBelow(healthScore1.healthScore, 0, "require unhealthy comet.");

    let userAddress = await cloneClient.getUserAddress();
    assert.equal(comet.collaterals[1].collateralIndex, 2);

    tokenData = await cloneClient.getTokenData();
    let mockAssetAssociatedTokenAddress =
      await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockAssetMint.publicKey
      );

    let user = await cloneClient.getUserAccount();

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
      await cloneClient.liquidateCometNonstableCollateralInstruction(
        cloneClient.provider.publicKey!,
        { userPubKey: userAddress.userPubkey, bump: userAddress.bump },
        user,
        comet,
        tokenData,
        toDevnetScale(nonstableCollateralAmount * nonstableCollateralPrice),
        1,
        0,
        onusdTokenAccountInfo.address,
        mockAssetAssociatedTokenAddress.address
      );

    await cloneClient.provider.sendAndConfirm!(
      new Transaction()
        .add(await cloneClient.updatePricesInstruction())
        .add(swapNonstableIx)
    );

    comet = await cloneClient.getComet();
    tokenData = await cloneClient.getTokenData();
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

    await cloneClient.program.methods
      .updatePoolParameters(0, {
        ilHealthScoreCoefficient: { value: convertToRawDecimal(100000) },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    comet = await cloneClient.getComet();
    tokenData = await cloneClient.getTokenData();
    let position = comet.positions[0];
    pool = tokenData.pools[position.poolIndex];
    let healthScore3 = getHealthScore(tokenData, comet);

    let { userPubkey, bump } = await cloneClient.getUserAddress();
    let userAccount = await cloneClient.getUserAccount();
    let liquidationIx = await cloneClient.program.methods
      .liquidateCometIld(
        0,
        toDevnetScale(toNumber(comet.positions[0].borrowedOnasset)),
        false
      )
      .accounts({
        liquidator: cloneClient.provider.publicKey!,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
        comet: userAccount.comet,
        userAccount: userPubkey,
        user: cloneClient.provider.publicKey!,
        onassetMint: pool.assetInfo.onassetMint,
        ammOnusdTokenAccount: pool.onusdTokenAccount,
        ammOnassetTokenAccount: pool.onassetTokenAccount,
        liquidatorOnusdTokenAccount: onusdTokenAccountInfo.address,
        liquidatorOnassetTokenAccount: onassetTokenAccountInfo.address,
        onusdMint: cloneClient.clone!.onusdMint,
        onusdVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await cloneClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await cloneClient.updatePricesInstruction())
        .add(liquidationIx)
    );
    comet = await cloneClient.getComet();
    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    let healthScore4 = getHealthScore(tokenData, comet);
    assert.isAbove(
      healthScore4.healthScore,
      healthScore3.healthScore,
      "check liquidation for reducing IL"
    );

    let positionLiquidationIx = await cloneClient.program.methods
      .liquidateCometBorrow(
        0,
        toDevnetScale(toNumber(comet.positions[0].borrowedOnusd))
      )
      .accounts({
        liquidator: cloneClient.provider.publicKey!,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
        comet: userAccount.comet,
        userAccount: userPubkey,
        cometLiquidityTokenAccount:
          tokenData.pools[comet.positions[0].poolIndex]
            .cometLiquidityTokenAccount,
        user: cloneClient.provider.publicKey!,
        onassetMint: pool.assetInfo.onassetMint,
        ammOnusdTokenAccount: pool.onusdTokenAccount,
        ammOnassetTokenAccount: pool.onassetTokenAccount,
        liquidatorOnusdTokenAccount: onusdTokenAccountInfo.address,
        liquidatorOnassetTokenAccount: onassetTokenAccountInfo.address,
        onusdMint: cloneClient.clone!.onusdMint,
        onusdVault: tokenData.collaterals[0].vault,
        liquidityTokenMint:
          tokenData.pools[comet.positions[0].poolIndex].liquidityTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    await cloneClient.provider.sendAndConfirm!(
      new anchor.web3.Transaction()
        .add(await cloneClient.updatePricesInstruction())
        .add(positionLiquidationIx)
    );

    comet = await cloneClient.getComet();
    tokenData = await cloneClient.getTokenData();
    pool = tokenData.pools[position.poolIndex];
    let healthScore5 = getHealthScore(tokenData, comet);
    assert.isAbove(
      healthScore5.healthScore,
      healthScore4.healthScore,
      "check liquidation for reducing IL"
    );
  });

  it("borrow position liquidation", async () => {
    let tokenData = await cloneClient.getTokenData();
    let userMintPositions = await cloneClient.getBorrowPositions();
    let positionIndex = 1;
    let position = userMintPositions.borrowPositions[positionIndex];
    let poolIndex = Number(position.poolIndex);
    let collateralIndex = Number(position.collateralIndex);
    let collateral = tokenData.collaterals[collateralIndex];
    let pool = tokenData.pools[poolIndex];
    let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      collateral.mint
    );
    let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    // Mint more onasset to pay for liquidation.
    await cloneClient.initializeBorrowPosition(
      toDevnetScale(19000),
      toDevnetScale(19000 * toNumber(pool.assetInfo.price) * 1.51),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      poolIndex,
      collateralIndex
    );

    userMintPositions = await cloneClient.getBorrowPositions();
    position = userMintPositions.borrowPositions[positionIndex];
    let numMintPositions = userMintPositions.numPositions.toNumber();

    let priceThreshold =
      toNumber(position.collateralAmount) /
      (1.5 * toNumber(position.borrowedOnasset));

    await setPrice(
      pythProgram,
      priceThreshold * 1.1,
      pool.assetInfo.pythAddress
    );

    await cloneClient.provider.sendAndConfirm!(
      new Transaction()
        .add(await cloneClient.updatePricesInstruction())
        .add(
          await cloneClient.liquidateBorrowPositionInstruction(
            cloneClient.provider.publicKey!,
            positionIndex,
            collateralTokenAccountInfo.address,
            onassetTokenAccountInfo.address
          )
        )
    );
    userMintPositions = await cloneClient.getBorrowPositions();
    assert.equal(
      numMintPositions - 1,
      userMintPositions.numPositions.toNumber(),
      "Liquidation did not finish!"
    );

    // Reset params
    await cloneClient.program.methods
      .updatePoolParameters(0, {
        positionHealthScoreCoefficient: {
          value: convertToRawDecimal(healthScoreCoefficient),
        },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    await cloneClient.program.methods
      .updatePoolParameters(0, {
        ilHealthScoreCoefficient: {
          value: convertToRawDecimal(ilHealthScoreCoefficient),
        },
      })
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
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

    await cloneClient.initializePool(
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
    await cloneClient.devnetMintOnusd(
      onusdTokenAccountInfo.address,
      8000000 * 100000000
    );

    let tokenData = await cloneClient.getTokenData();
    let pool = tokenData.pools[1];

    onusdTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      cloneClient.clone!.onusdMint
    );

    onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    liquidityTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.liquidityTokenMint
    );

    // Initialize liquidity position
    await cloneClient.initializeBorrowPosition(
      new BN(2000000000000),
      new BN(5000000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      1,
      0
    );

    await cloneClient.provideUnconcentratedLiquidity(
      toDevnetScale(20000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
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
          cloneClient.provider.publicKey!.toBuffer(),
        ],
        cometManagerProgram.programId
      );
    cometManagerInfoAddress = managerInfoAddress;

    const [userAccountAddress, userAccountBump] =
      await PublicKey.findProgramAddress(
        [Buffer.from("user"), managerInfoAddress.toBuffer()],
        cloneClient.programId
      );

    let createIx = await cloneClient.program.account.comet.createInstruction(
      cometAccount
    );

    let createManagerIx = await cometManagerProgram.methods
      .initialize(userAccountBump, 2000, 16)
      .accounts({
        admin: cloneClient.provider.publicKey!,
        managerInfo: managerInfoAddress,
        userAccount: userAccountAddress,
        comet: cometAccount.publicKey,
        clone: cloneClient.cloneAddress[0],
        cloneProgram: cloneClient.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    await cloneClient.provider.sendAndConfirm!(
      new Transaction().add(createIx).add(createManagerIx),
      [cometAccount]
    );

    let cometManagerUser = await cloneClient.getUserAccount(
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
      cometManagerInfo.cloneProgram.equals(cloneClient.programId),
      "clone program id"
    );
    assert.isTrue(
      cometManagerInfo.clone.equals(cloneClient.cloneAddress[0]),
      "clone manager"
    );
    assert.isTrue(
      cometManagerInfo.owner.equals(cloneClient.provider.publicKey!),
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
          cloneClient.provider.publicKey!.toBuffer(),
          cometManagerInfoAddress.toBuffer(),
        ],
        cometManagerProgram.programId
      )
    )[0];

    await cometManagerProgram.methods
      .initializeSubscription()
      .accounts({
        subscriber: subscribeAccountAddress,
        subscriptionOwner: cloneClient.provider.publicKey!,
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
      subscriberAccount.owner.equals(cloneClient.provider.publicKey!)
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
    let subscriberOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
    );
    let currentOnusdBalance =
      Number(subscriberOnusdTokenAccount.amount) / 100000000;
    let cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );

    let cometManagerUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await cloneClient.getTokenData();
    await cometManagerProgram.methods
      .subscribe(toDevnetScale(100))
      .accounts({
        subscriber: cometManagerProgram.provider.publicKey!,
        subscriberAccount: subscribeAccountAddress,
        managerInfo: cometManagerInfoAddress,
        clone: cloneClient.cloneAddress[0],
        managerCloneUser: cometManagerInfo.userAccount,
        onusdMint: cloneClient.clone!.onusdMint,
        subscriberOnusdTokenAccount: subscriberOnusdTokenAccount.address,
        managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
        cloneProgram: cloneClient.programId,
        tokenData: cloneClient.clone!.tokenData,
        cloneOnusdVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    let subscriberAccount = (await cometManagerProgram.account.subscriber.fetch(
      subscribeAccountAddress
    )) as Subscriber;
    subscriberOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
    );
    let comet = await cloneClient.getComet(cometManagerInfo.userAccount);
    cometManagerInfo = (await cometManagerProgram.account.managerInfo.fetch(
      cometManagerInfoAddress
    )) as ManagerInfo;
    cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
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
      Number(subscriberOnusdTokenAccount.amount) / 100000000,
      currentOnusdBalance - 100,
      "onusd balance"
    );

    assert.equal(
      toNumber(comet.collaterals[0].collateralAmount),
      0,
      "collateral amount"
    );

    assert.equal(
      Number(cometManagerOnusdTokenAccount.amount) / 100000000,
      100,
      "Manager onusd balance"
    );

    assert.equal(comet.collaterals[0].collateralIndex, 0, "collateral index");
  });

  it("comet manager add liquidity ", async () => {
    let cometManagerUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await cloneClient.getTokenData();
    let poolIndex = 0;
    let onusdAmount = 120;
    let cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );

    let tx = new Transaction()
      .add(await cloneClient.updatePricesInstruction())
      .add(
        await cometManagerProgram.methods
          .addCollateralToComet(toDevnetScale(100))
          .accounts({
            managerOwner: cloneClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            clone: cloneClient.cloneAddress[0],
            managerCloneUser: cometManagerInfo.userAccount,
            onusdMint: cloneClient.clone!.onusdMint,
            cloneProgram: cloneClient.programId,
            comet: cometManagerUser.comet,
            tokenData: cloneClient.clone!.tokenData,
            tokenProgram: TOKEN_PROGRAM_ID,
            managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
            cloneOnusdVault: tokenData.collaterals[0].vault,
          })
          .instruction()
      )
      .add(
        await cometManagerProgram.methods
          .addLiquidity(poolIndex, toDevnetScale(onusdAmount))
          .accounts({
            managerOwner: cloneClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            clone: cloneClient.cloneAddress[0],
            managerCloneUser: cometManagerInfo.userAccount,
            onusdMint: cloneClient.clone!.onusdMint,
            cloneProgram: cloneClient.programId,
            comet: cometManagerUser.comet,
            tokenData: cloneClient.clone!.tokenData,
            onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
            ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
            ammOnassetTokenAccount:
              tokenData.pools[poolIndex].onassetTokenAccount,
            liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
            cometLiquidityTokenAccount:
              tokenData.pools[poolIndex].cometLiquidityTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

    await cloneClient.provider.sendAndConfirm!(tx);

    let comet = await cloneClient.getComet(cometManagerInfo.userAccount);
    assert.equal(Number(comet.numPositions), 1, "Number positions");
    assert.equal(
      toNumber(comet.positions[0].borrowedOnusd),
      onusdAmount,
      "Onusd position size"
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
    let cometManagerUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await cloneClient.getTokenData();
    let poolIndex = 0;
    let positionIndex = 0;
    let comet = await cloneClient.getComet(cometManagerInfo.userAccount);
    let cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );
    let cometManagerOnassetTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        cometManagerProgram.provider,
        tokenData.pools[poolIndex].assetInfo.onassetMint,
        cometManagerInfoAddress,
        true
      );

    // Add token transfer instructions to transaction
    const transaction = new Transaction().add(
      createTransferInstruction(
        onusdTokenAccountInfo.address,
        cometManagerOnusdTokenAccount.address,
        provider.publicKey!,
        toDevnetScale(100).toNumber(),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Sign transaction, broadcast, and confirm
    await provider.sendAndConfirm!(transaction);

    // Withdraw all liquidity
    await cometManagerProgram.methods
      .withdrawLiquidity(
        0,
        toDevnetScale(toNumber(comet.positions[0].liquidityTokenValue) * 2)
      )
      .accounts({
        signer: cloneClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        clone: cloneClient.cloneAddress[0],
        managerCloneUser: cometManagerInfo.userAccount,
        onusdMint: cloneClient.clone!.onusdMint,
        cloneProgram: cloneClient.programId,
        comet: cometManagerUser.comet,
        tokenData: cloneClient.clone!.tokenData,
        cloneOnusdVault: tokenData.collaterals[0].vault,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount: tokenData.pools[poolIndex].onassetTokenAccount,
        liquidityTokenMint: tokenData.pools[poolIndex].liquidityTokenMint,
        cometLiquidityTokenAccount:
          tokenData.pools[poolIndex].cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
        managerOnassetTokenAccount: cometManagerOnassetTokenAccount.address,
      })
      .rpc();
    comet = await cloneClient.getComet(cometManagerInfo.userAccount);

    await cometManagerProgram.methods
      .payIld(
        positionIndex,
        toDevnetScale(toNumber(comet.positions[positionIndex].borrowedOnusd)),
        true
      )
      .accounts({
        signer: cloneClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        clone: cloneClient.cloneAddress[0],
        managerCloneUser: cometManagerInfo.userAccount,
        onusdMint: cloneClient.clone!.onusdMint,
        cloneProgram: cloneClient.programId,
        comet: cometManagerUser.comet,
        tokenData: cloneClient.clone!.tokenData,
        cloneOnusdVault: tokenData.collaterals[0].vault,
        onassetMint: tokenData.pools[poolIndex].assetInfo.onassetMint,
        ammOnusdTokenAccount: tokenData.pools[poolIndex].onusdTokenAccount,
        ammOnassetTokenAccount: tokenData.pools[poolIndex].onassetTokenAccount,
        managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
        managerOnassetTokenAccount: cometManagerOnassetTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    comet = await cloneClient.getComet(cometManagerInfo.userAccount);

    assert.equal(
      toNumber(comet.positions[0].borrowedOnusd),
      0,
      "Onusd position size"
    );
    assert.equal(
      toNumber(comet.positions[0].borrowedOnasset),
      0,
      "Onasset position size"
    );
    assert.equal(
      toNumber(comet.collaterals[0].collateralAmount),
      100,
      "collateral amount"
    );
  });

  it("comet manager redemption!", async () => {
    let usdcMint = jupiterAccount.usdcMint;
    let subscriberOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
    );
    const subscriberOnusdValue = Number(subscriberOnusdTokenAccount.amount);

    let cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );
    let cometManagerUsdcTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      usdcMint,
      cometManagerInfoAddress,
      true
    );

    let cometManagerUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let tokenData = await cloneClient.getTokenData();
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
        pool.assetInfo.onassetMint,
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
      .add(await cloneClient.updatePricesInstruction())
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
            signer: cloneClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            clone: cloneClient.cloneAddress[0],
            managerCloneUser: cometManagerInfo.userAccount,
            onusdMint: cloneClient.clone!.onusdMint,
            usdcMint: usdcMint,
            comet: cometManagerUser.comet,
            tokenData: cloneClient.clone!.tokenData,
            managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
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
            signer: cloneClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            clone: cloneClient.cloneAddress[0],
            managerCloneUser: cometManagerInfo.userAccount,
            onusdMint: cloneClient.clone!.onusdMint,
            comet: cometManagerUser.comet,
            tokenData: cloneClient.clone!.tokenData,
            managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
            cloneOnusdVault: tokenData.collaterals[0].vault,
            cloneProgram: cloneClient.programId,
          })
          .instruction()
      )
      .add(
        await cometManagerProgram.methods
          .fulfillRedemptionRequest(0)
          .accounts({
            managerOwner: cloneClient.provider.publicKey!,
            managerInfo: cometManagerInfoAddress,
            clone: cloneClient.cloneAddress[0],
            managerCloneUser: cometManagerInfo.userAccount,
            subscriberAccount: subscribeAccountAddress,
            onusdMint: cloneClient.clone!.onusdMint,
            subscriberOnusdTokenAccount: subscriberOnusdTokenAccount.address,
            managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
            cloneProgram: cloneClient.programId,
            tokenData: cloneClient.clone!.tokenData,
            cloneOnusdVault: tokenData.collaterals[0].vault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      );
    const lookupTableAccount = await cloneClient.provider.connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);
    const { blockhash } =
      await cloneClient.provider.connection.getLatestBlockhash("finalized");
    const versionedTx = createVersionedTx(
      cloneProgram.provider.publicKey!,
      blockhash,
      tx,
      lookupTableAccount!
    );
    await cloneClient.provider.sendAndConfirm!(versionedTx);

    subscriberOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
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
      Number(subscriberOnusdTokenAccount.amount),
      subscriberOnusdValue,
      "Onusd account"
    );
  });

  it("pay ILD to close out position!", async () => {
    let cometManagerUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    let comet = await cloneClient.getComet(cometManagerInfo.userAccount);
    let positionIndex = 0;

    let removeCometIx = await cometManagerProgram.methods
      .removeCometPosition(positionIndex)
      .accounts({
        signer: cloneClient.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        clone: cloneClient.cloneAddress[0],
        managerCloneUser: cometManagerInfo.userAccount,
        cloneProgram: cloneClient.programId,
        comet: cometManagerUser.comet,
        tokenData: cloneClient.clone!.tokenData,
      })
      .instruction();

    let tx = new Transaction().add(removeCometIx);

    await cloneClient.provider.sendAndConfirm!(tx);

    comet = await cloneClient.getComet(cometManagerInfo.userAccount);

    assert.equal(comet.numPositions.toNumber(), 0, "num positions");
  });

  it("comet manager onusd withdraw", async () => {
    let ownerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
    );

    let currentOnusdBalance = ownerOnusdTokenAccount.amount;

    let cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );

    let managerOnusdBalance = Number(cometManagerOnusdTokenAccount.amount);

    await cometManagerProgram.methods
      .ownerWithdrawal(new BN(managerOnusdBalance))
      .accounts({
        managerOwner: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        clone: cloneClient.cloneAddress[0],
        onusdMint: cloneClient.clone!.onusdMint,
        managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
        ownerOnusdTokenAccount: ownerOnusdTokenAccount.address,
      })
      .rpc();

    ownerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
    );

    cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );

    assert.equal(
      Number(ownerOnusdTokenAccount.amount),
      Number(currentOnusdBalance) + managerOnusdBalance,
      "owner onusd account"
    );
    assert.equal(
      Number(cometManagerOnusdTokenAccount.amount),
      0,
      "manager onusd account"
    );
  });

  it("initializing comet manager termination!", async () => {
    let cometManagerUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );
    await cometManagerProgram.methods
      .initiateCometManagerClosing()
      .accounts({
        signer: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        managerCloneUser: cometManagerInfo.userAccount,
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
    let cometManagerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint,
      cometManagerInfoAddress,
      true
    );
    let ownerOnusdTokenAccount = await getOrCreateAssociatedTokenAccount(
      cometManagerProgram.provider,
      cloneClient.clone!.onusdMint
    );
    let tokenData = await cloneClient.getTokenData();

    let cometManagerCloneUser = await cloneClient.getUserAccount(
      cometManagerInfo.userAccount
    );

    await cometManagerProgram.methods
      .closeCometManager()
      .accounts({
        managerOwner: cometManagerProgram.provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        clone: cloneClient.cloneAddress[0],
        managerCloneUser: cometManagerInfo.userAccount,
        onusdMint: cloneClient.clone!.onusdMint,
        managerOnusdTokenAccount: cometManagerOnusdTokenAccount.address,
        treasuryOnusdTokenAccount: treasuryOnusdTokenAccount.address,
        cloneProgram: cloneClient.programId,
        comet: cometManagerCloneUser.comet,
        tokenData: cloneClient.clone!.tokenData,
        cloneOnusdVault: tokenData.collaterals[0].vault,
        ownerOnusdTokenAccount: ownerOnusdTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("wrap assets and unwrap onassets", async () => {
    const poolIndex = 0;
    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[poolIndex];
    const jupiterData = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    let mockAssetAssociatedTokenAccount =
      await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        jupiterData.assetMints[0]
      );

    let onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
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
      cloneClient.provider,
      jupiterData.assetMints[0]
    );

    let startingAssetBalance = Number(mockAssetAssociatedTokenAccount.amount);
    let startingOnassetBalance = Number(onassetAssociatedTokenAccount.amount);

    let amount = toDevnetScale(5);
    let [cloneAddress, bump] = await cloneClient.getCloneAddress();

    // Wrap to onasset
    await cloneProgram.methods
      .wrapAsset(amount, poolIndex)
      .accounts({
        user: cloneClient.provider.publicKey!,
        tokenData: cloneClient.clone!.tokenData,
        underlyingAssetTokenAccount: pool.underlyingAssetTokenAccount!,
        assetMint: jupiterData.assetMints[0],
        userAssetTokenAccount: mockAssetAssociatedTokenAccount.address,
        onassetMint: pool.assetInfo.onassetMint,
        userOnassetTokenAccount: onassetAssociatedTokenAccount.address,
        clone: cloneClient.cloneAddress[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      jupiterData.assetMints[0]
    );
    onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );

    assert.equal(
      startingAssetBalance - Number(mockAssetAssociatedTokenAccount.amount),
      Number(amount),
      "check asset"
    );
    assert.equal(
      Number(onassetAssociatedTokenAccount.amount) - startingOnassetBalance,
      Number(amount),
      "check onasset"
    );

    // Unwrap to asset
    await cloneProgram.methods
      .unwrapOnasset(amount, poolIndex)
      .accounts({
        user: cloneClient.provider.publicKey!,
        tokenData: cloneClient.clone!.tokenData,
        underlyingAssetTokenAccount: pool.underlyingAssetTokenAccount!,
        assetMint: jupiterData.assetMints[0],
        userAssetTokenAccount: mockAssetAssociatedTokenAccount.address,
        onassetMint: pool.assetInfo.onassetMint,
        userOnassetTokenAccount: onassetAssociatedTokenAccount.address,
        clone: cloneAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      jupiterData.assetMints[0]
    );
    onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      cloneClient.provider,
      pool.assetInfo.onassetMint
    );
    assert.equal(
      Number(mockAssetAssociatedTokenAccount.amount),
      startingAssetBalance
    );
    assert.equal(
      Number(onassetAssociatedTokenAccount.amount),
      startingOnassetBalance
    );
  });

  it("deprecate pool", async () => {
    await cloneProgram.methods
      .deprecatePool(1)
      .accounts({
        admin: cloneClient.clone!.admin,
        clone: cloneClient.cloneAddress[0],
        tokenData: cloneClient.clone!.tokenData,
      })
      .rpc();

    let tokenData = await cloneClient.getTokenData();
    assert.equal(tokenData.pools[1].deprecated, 1);
  });
});
