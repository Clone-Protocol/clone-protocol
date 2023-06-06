import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Clone } from "../sdk/src/idl/clone";
import { Pyth } from "../sdk/src/idl/pyth";
import { MockUsdc } from "../sdk/src/idl/mock_usdc";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import {
  Clone as CloneConnection,
  TokenData,
  User,
  MintPositions,
  LiquidityPositions,
  Manager,
  Pool,
} from "../sdk/src/clone";
import { createPriceFeed, setPrice, getFeedData } from "../sdk/src/oracle";
import { Network } from "../sdk/src/network";
import { CLONE_EXCHANGE_SEED } from "./utils";
import { sleep } from "../sdk/src/utils";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

describe("liquidation testing", function () {
  let cloneClient;
  let walletPubkey;
  let priceFeed;
  let mockUSDCTokenAccountInfo;
  let onusdTokenAccountInfo;
  let onassetTokenAccountInfo;
  let liquidityTokenAccountInfo;
  let mockUSDCMint;
  let pythProgram;

  before("setup clone client", async () => {
    const provider = anchor.Provider.local();
    anchor.setProvider(provider);

    const cloneProgram = anchor.workspace.Clone as Program<Clone>;
    pythProgram = anchor.workspace.Pyth as Program<Pyth>;
    const mockUSDCProgram = anchor.workspace.MockUsdc as Program<MockUsdc>;

    mockUSDCMint = anchor.web3.Keypair.generate();
    walletPubkey = cloneProgram.provider.wallet.publicKey;

    const mockUSDCAccount = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("mock_usdc")],
      mockUSDCProgram.programId
    );

    cloneClient = new CloneConnection(
      cloneProgram.programId,
      provider
    ) as CloneConnection;

    await cloneClient.initializeClone();

    await cloneClient.initializeUser();

    let price = 10;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    priceFeed = await createPriceFeed(pythProgram, price, expo, conf);

    await mockUSDCProgram.rpc.initialize(mockUSDCAccount[1], {
      accounts: {
        admin: walletPubkey,
        mockUsdcMint: mockUSDCMint.publicKey,
        mockUsdcAccount: mockUSDCAccount[0],
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      signers: [mockUSDCMint],
    });

    await cloneClient.addCollateral(
      walletPubkey,
      7,
      1,
      mockUSDCMint.publicKey
    );

    await cloneClient.initializePool(walletPubkey, 150, 200, priceFeed);

    await sleep(200);

    const tokenData = await cloneClient.getTokenData();
    const pool = tokenData.pools[0];

    mockUSDCTokenAccountInfo =
      await cloneClient.getOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    onusdTokenAccountInfo = await cloneClient.getOrCreateAssociatedTokenAccount(
      cloneClient.manager.onusdMint
    );
    liquidityTokenAccountInfo =
      await cloneClient.getOrCreateAssociatedTokenAccount(
        pool.liquidityTokenMint
      );
    onassetTokenAccountInfo =
      await cloneClient.getOrCreateAssociatedTokenAccount(
        pool.assetInfo.onassetMint
      );

    await mockUSDCProgram.rpc.mintMockUsdc(mockUSDCAccount[1], {
      accounts: {
        mockUsdcMint: mockUSDCMint.publicKey,
        mockUsdcTokenAccount: mockUSDCTokenAccountInfo.address,
        mockUsdcAccount: mockUSDCAccount[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [],
    });

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await cloneClient.mintOnUsd(
      new BN(100000000000000),
      onusdTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address,
      0,
      signers
    );

    await sleep(200);

    await cloneClient.initializeBorrowPositions(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0,
      0,
      signers
    );

    await cloneClient.initializeLiquidityPosition(
      new BN(10000000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      0
    );
  });

  it("comet liquidation lower price breached!", async () => {
    await sleep(2000);

    // Initialize a comet
    await cloneClient.initializeComet(
      mockUSDCTokenAccountInfo.address,
      new BN(2500000000),
      new BN(50000000000),
      0,
      0
    );
    // Make a trade to trigger the price
    await cloneClient.sellonAsset(
      new BN(4500000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0
    );

    const { userPubkey, _bump } = await cloneClient.getUserAddress();

    let cometPositions = await cloneClient.getCometPositions();

    assert.equal(
      Number(cometPositions.numPositions),
      1,
      "check comet was initialized"
    );

    await cloneClient.liquidateComet(userPubkey, 0);

    await sleep(200);

    await cloneClient.claimLiquidatedComet(0);

    await sleep(200);

    cometPositions = await cloneClient.getCometPositions();

    assert.equal(
      Number(cometPositions.numPositions),
      0,
      "check comet was closed/liquidated"
    );
  });

  it("comet liquidation upper price breached!", async () => {
    await sleep(2000);

    // // Initialize a comet
    await cloneClient.initializeComet(
      mockUSDCTokenAccountInfo.address,
      new BN(2500000000),
      new BN(50000000000),
      0,
      0
    );
    // Make a trade to trigger the price
    await cloneClient.buyonAsset(
      new BN(4200000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0
    );

    const { userPubkey, _bump } = await cloneClient.getUserAddress();

    let cometPositions = await cloneClient.getCometPositions();

    assert.equal(
      Number(cometPositions.numPositions),
      1,
      "check comet was initialized"
    );

    await cloneClient.liquidateComet(userPubkey, 0);

    await sleep(200);

    await cloneClient.claimLiquidatedComet(0);

    await sleep(200);

    cometPositions = await cloneClient.getCometPositions();

    assert.equal(
      Number(cometPositions.numPositions),
      0,
      "check comet was closed/liquidated"
    );
  });

  it("partial comet liquidation", async () => {
    await sleep(200);

    // Initialize a comet
    await cloneClient.initializeComet(
      mockUSDCTokenAccountInfo.address,
      new BN(2500000000),
      new BN(50000000000),
      0,
      0
    );

    // // Make a trade to trigger the price
    await cloneClient.sellonAsset(
      new BN(500000000000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0
    );

    const { userPubkey, _bump } = await cloneClient.getUserAddress();
    let tokenData: TokenData = await cloneClient.getTokenData();
    let cometPositions = await cloneClient.getCometPositions();

    let pool: Pool =
      tokenData.pools[cometPositions.cometPositions[0].poolIndex];

    let liquidatorOnAssetTokenAccount =
      await cloneClient.getOrCreateAssociatedTokenAccount(
        pool.assetInfo.onassetMint
      );

    let initialCometPosition = cometPositions.cometPositions[0];

    await cloneClient.partialCometLiquidation(
      userPubkey,
      liquidatorOnAssetTokenAccount.address,
      0
    );

    await sleep(200);
    cometPositions = await cloneClient.getCometPositions();
    assert.equal(
      Number(cometPositions.numPositions),
      1,
      "check comet was not completely liquidated"
    );

    let finalCometPosition = cometPositions.cometPositions[0];

    assert(
      Number(initialCometPosition.lowerPriceRange.val) >
        Number(finalCometPosition.lowerPriceRange.val),
      "check lower price range"
    );
    assert(
      Number(initialCometPosition.upperPriceRange.val) >
        Number(finalCometPosition.upperPriceRange.val),
      "check upper price range"
    );
  });

  it("mint position liquidation", async () => {
    // Add more concentrated liquidity to the pool.
    await cloneClient.initializeComet(
      mockUSDCTokenAccountInfo.address,
      new BN(250000000000),
      new BN(5000000000000),
      0,
      0
    );

    onusdTokenAccountInfo = await cloneClient.getOrCreateAssociatedTokenAccount(
      cloneClient.manager.onusdMint
    );

    await cloneClient.devnetMintOnUsd(
      onusdTokenAccountInfo.address,
      5000000000000000
    );

    await sleep(200);

    // buy to burn
    await cloneClient.buyonAsset(
      new BN(20_350_000_000_000),
      onusdTokenAccountInfo.address,
      onassetTokenAccountInfo.address,
      0
    );

    await sleep(200);

    await setPrice(pythProgram, 67, priceFeed);

    const { userPubkey, _bump } = await cloneClient.getUserAddress();

    let beforeLiquidationOnAsset =
      await cloneClient.connection.getTokenAccountBalance(
        onassetTokenAccountInfo.address,
        "recent"
      );
    let beforeLiquidationCollateral =
      await cloneClient.connection.getTokenAccountBalance(
        mockUSDCTokenAccountInfo.address,
        "recent"
      );

    // call liquidation.
    await cloneClient.liquidateBorrowPosition(userPubkey, 0);

    await sleep(200);

    let afterLiquidationOnAsset =
      await cloneClient.connection.getTokenAccountBalance(
        onassetTokenAccountInfo.address,
        "recent"
      );
    let afterLiquidationCollateral =
      await cloneClient.connection.getTokenAccountBalance(
        mockUSDCTokenAccountInfo.address,
        "recent"
      );

    assert.equal(
      beforeLiquidationOnAsset.value.uiAmount -
        afterLiquidationOnAsset.value.uiAmount,
      200000,
      "check liquidated amount"
    );
    assert.equal(
      afterLiquidationCollateral.value.uiAmount -
        beforeLiquidationCollateral.value.uiAmount,
      20000000,
      "check collateral received"
    );
  });
});
