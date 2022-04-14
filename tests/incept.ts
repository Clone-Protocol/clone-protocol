import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { MockUsdc } from "../sdk/src/idl/mock_usdc";
import { Store } from "../sdk/src/idl/store";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import {
  Incept as InceptConnection,
  TokenData,
  User,
  CometPositions,
  MintPositions,
  LiquidityPositions,
  Manager,
  Pool,
} from "../sdk/src/incept";
import {
  createPriceFeed,
  setPrice,
  getFeedData,
  ChainLinkOracle,
} from "./oracle";
import { sleep } from "../sdk/src/utils";

const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

describe("incept", async () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);

  let inceptProgram = anchor.workspace.Incept as Program<Incept>;
  let pythProgram = anchor.workspace.Pyth as Program<Pyth>;
  let mockUSDCProgram = anchor.workspace.MockUsdc as Program<MockUsdc>;
  let walletPubkey = inceptProgram.provider.wallet.publicKey;
  let storeProgram = anchor.workspace.Store as Program<Store>;

  let chainlink; //= new ChainLinkOracle(storeProgram);

  const mockUSDCMint = anchor.web3.Keypair.generate();
  const mockUSDCAccount = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("mock_usdc")],
    mockUSDCProgram.programId
  );

  let priceFeed;
  let mockUSDCTokenAccountInfo;
  let usdiTokenAccountInfo;
  let iassetTokenAccountInfo;
  let liquidityTokenAccountInfo;

  // @ts-expect-error
  let inceptClient = new InceptConnection(
    inceptProgram.programId,
    provider
  ) as InceptConnection;

  it("mock usdc initialized!", async () => {
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
  });

  it("manager initialized!", async () => {
    await inceptClient.initializeManager(storeProgram.programId);
  });

  it("user initialized!", async () => {
    await inceptClient.initializeUser();

    let userAccountData = await inceptClient.getUserAccount();

    assert(
      !userAccountData.authority.equals(anchor.web3.PublicKey.default),
      "check authority address"
    );
    assert(
      !userAccountData.cometPositions.equals(anchor.web3.PublicKey.default),
      "check comet position address"
    );
    assert(
      !userAccountData.mintPositions.equals(anchor.web3.PublicKey.default),
      "check mint position address"
    );
    assert(
      !userAccountData.liquidityPositions.equals(anchor.web3.PublicKey.default),
      "check liquidity position address"
    );

    const cometPositions = (await inceptProgram.account.cometPositions.fetch(
      userAccountData.cometPositions
    )) as CometPositions;

    assert(
      !cometPositions.owner.equals(anchor.web3.PublicKey.default),
      "check comet positions owner"
    );
    assert(
      cometPositions.numPositions.eq(new BN(0)),
      "check num comet positions"
    );

    const mintPositions = (await inceptProgram.account.mintPositions.fetch(
      userAccountData.mintPositions
    )) as MintPositions;

    assert(
      !mintPositions.owner.equals(anchor.web3.PublicKey.default),
      "check mint positions owner"
    );
    assert(
      mintPositions.numPositions.eq(new BN(0)),
      "check num mint positions"
    );

    const liquidityPositions =
      (await inceptProgram.account.liquidityPositions.fetch(
        userAccountData.liquidityPositions
      )) as LiquidityPositions;

    assert(
      !liquidityPositions.owner.equals(anchor.web3.PublicKey.default),
      "check liquidity positions owner"
    );
    assert(
      liquidityPositions.numPositions.eq(new BN(0)),
      "check num liquidity positions"
    );
  });

  it("change feed price", async () => {
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

  it("pool initialized!", async () => {
    await inceptClient.initializePool(
      walletPubkey,
      150,
      200,
      priceFeed,
      chainlink.priceFeedPubkey()
    );
  });

  it("token data initialization check", async () => {
    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;

    assert(
      tokenData.manager.equals(inceptClient.managerAddress[0]),
      "wrong manager!"
    );
    assert(tokenData.numPools.eq(new BN(1)), "num pools incorrect");
    assert(tokenData.numCollaterals.eq(new BN(1)), "num collaterals incorrect");

    const first_pool = tokenData.pools[0];
    assert(
      !first_pool.iassetTokenAccount.equals(anchor.web3.PublicKey.default),
      "check iassetTokenAccount"
    );
    assert(
      !first_pool.usdiTokenAccount.equals(anchor.web3.PublicKey.default),
      "check iassetTokenAccount"
    );
    assert(
      !first_pool.liquidityTokenMint.equals(anchor.web3.PublicKey.default),
      "check iassetTokenAccount"
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

    var valueToDecimal = function (value): Number {
      return Number(value.val) * 10 ** -Number(value.scale);
    };

    assert(
      assetInfo.priceFeedAddresses[0].equals(priceFeed),
      "check price feed"
    );

    assert.equal(
      valueToDecimal(assetInfo.stableCollateralRatio),
      1.5,
      "stable collateral ratio incorrect"
    );
    assert.equal(
      valueToDecimal(assetInfo.cryptoCollateralRatio),
      2,
      "crypto collateral ratio incorrect"
    );

    const first_collateral = tokenData.collaterals[0];
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
    await inceptClient.updatePrices(signers);
    await sleep(200);
  });

  it("mock usdc minted!", async () => {
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    for (let i = 0; i < 1; i++) {
      await mockUSDCProgram.rpc.mintMockUsdc(mockUSDCAccount[1], {
        accounts: {
          mockUsdcMint: mockUSDCMint.publicKey,
          mockUsdcTokenAccount: mockUSDCTokenAccountInfo.address,
          mockUsdcAccount: mockUSDCAccount[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [],
      });
    }
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      1000000000000,
      "check USDC amount"
    );
  });

  it("usdi minted!", async () => {
    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.mintUsdi(
      new BN(100000000000000),
      usdiTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address,
      0,
      signers
    );

    await sleep(200);

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      100,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999999000000,
      "check USDC amount"
    );

    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[0].vault,
      "confirmed"
    );
    assert.equal(vault.value!.uiAmount, 1000000, "check usdc vault amount");
  });

  it("iasset minted!", async () => {
    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;
    const pool = tokenData.pools[0];

    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.initializeMintPositions(
      new BN(20000000000000),
      new BN(200000000000000),
      mockUSDCTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      0,
      0,
      signers
    );

    await sleep(200);

    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      20,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999979000000,
      "check USDC amount"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[0].vault,
      "confirmed"
    );
    assert.equal(vault.value!.uiAmount, 21000000, "check usdc vault amount");
  });

  it("mint collateral added!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.addCollateralToMint(
      mockUSDCTokenAccountInfo.address,
      new BN(1000000000),
      0,
      signers
    );

    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;
    const pool = tokenData.pools[0];

    await sleep(200);

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      20,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999900,
      "check USDC amount"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[0].vault,
      "confirmed"
    );
    assert.equal(vault.value!.uiAmount, 21000100, "check usdc vault amount");
  });

  it("mint collateral removed!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.withdrawCollateralFromMint(
      mockUSDCTokenAccountInfo.address,
      new BN(1000000000),
      0,
      signers
    );

    await sleep(200);
    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;

    const pool = tokenData.pools[0];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      20,
      "check iasset token amount"
    );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999979000000,
      "check USDC amount"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      tokenData.collaterals[0].vault,
      "confirmed"
    );
    assert.equal(vault.value!.uiAmount, 21000000, "check usdc vault amount");
  });

  it("iasset burned!", async () => {
    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;

    const pool = tokenData.pools[0];
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    let userAccountData = await inceptClient.getUserAccount();
    let { userPubkey, bump } = await inceptClient.getUserAddress();
    let assetInfo = await inceptClient.getAssetInfo(0);

    await inceptProgram.rpc.payBackMint(
      inceptClient.managerAddress[1],
      bump,
      new BN(0),
      new BN(5000000),
      {
        accounts: {
          user: walletPubkey,
          manager: inceptClient.managerAddress[0],
          tokenData: inceptClient.manager.tokenData,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          mintPositions: userAccountData.mintPositions,
          iassetMint: assetInfo.iassetMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      19.999995,
      "check user iasset balance."
    );
  });

  it("iasset reminted!", async () => {
    const tokenData = (await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    )) as TokenData;

    const pool = tokenData.pools[0];
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    await inceptClient.addiAssetToMint(
      new BN(5000000),
      iassetTokenAccountInfo.address,
      0,
      0
    );

    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      20,
      "check user iasset balance"
    );
  });

  it("liquidity position initialized!", async () => {
    const tokenData = await inceptClient.getTokenData();

    const pool = tokenData.pools[0];

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    liquidityTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
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

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    liquidityTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.liquidityTokenMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      50,
      "check usdi"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      10,
      "check iasset"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 1000000000000,
      500,
      "check liquidity tokens"
    );

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "confirmed"
      );
    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      500000,
      "check usdi account balance"
    );

    const iassetAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "confirmed"
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

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    liquidityTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
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

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    liquidityTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.liquidityTokenMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      49.9995,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      9.9999,
      "check user iAsset balance"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 1000000000000,
      500.004995,
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

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    liquidityTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
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

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );
    liquidityTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.liquidityTokenMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      54.54485445309,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      10.908970890618,
      "check user iAsset balance"
    );
    assert.equal(
      Number(liquidityTokenAccountInfo.amount) / 1000000000000,
      454.5514495455,
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
      454551.4554691,
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
      90910.29109382,
      "check pool iAsset balance."
    );
  });

  it("iasset bought!", async () => {
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    await inceptClient.buySynth(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      48.926886091785,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      11.908970890618,
      "check user iAsset balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "confirmed"
          )
        ).value!.uiAmount
      ),
      510731.13908215,
      "check pool usdi balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "confirmed"
          )
        ).value!.uiAmount
      ),
      80910.29109382,
      "check pool iAsset balance"
    );
  });

  it("iasset sold!", async () => {
    const tokenData = await inceptClient.getTokenData();
    const poolIndex = 0;
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    await inceptClient.sellSynth(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      54.544854453091,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      10.908970890618,
      "check user iAsset balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.usdiTokenAccount,
            "confirmed"
          )
        ).value!.uiAmount
      ),
      454551.45546909,
      "check pool usdi balance"
    );
    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            pool.iassetTokenAccount,
            "confirmed"
          )
        ).value!.uiAmount
      ),
      90910.29109382,
      "check pool iAsset balance"
    );
  });

  it("comet initialized!", async () => {
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.initializeComet(
      mockUSDCTokenAccountInfo.address,
      new BN(2500000000),
      new BN(50000000000),
      0,
      0
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];
    const collateral = tokenData.collaterals[0];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999750,
      "check user USDI"
    );

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "confirmed"
      );

    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      455051.45546909,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "confirmed"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91010.29109402,
      "check iasset pool balance"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "confirmed"
    );

    assert.equal(vault.value!.uiAmount, 21000250, "check vault balance");
  });

  it("comet collateral added!", async () => {
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.addCollateralToComet(
      mockUSDCTokenAccountInfo.address,
      new BN(50000000),
      0
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];
    const collateral = tokenData.collaterals[0];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999745,
      "check user USDI"
    );

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      455051.45546909,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91010.29109402,
      "check iasset pool balance"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(vault.value!.uiAmount, 21000255, "check vault balance");
  });

  it("comet collateral withdrawn!", async () => {
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.withdrawCollateralFromComet(
      mockUSDCTokenAccountInfo.address,
      new BN(50000000),
      0
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[0];
    const collateral = tokenData.collaterals[0];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999750,
      "check user USDI"
    );

    const usdiAccountBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.usdiTokenAccount,
        "recent"
      );

    assert.equal(
      usdiAccountBalance.value!.uiAmount,
      455051.45546909,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91010.29109402,
      "check iasset pool balance"
    );

    const vault = await inceptClient.connection.getTokenAccountBalance(
      collateral.vault,
      "recent"
    );

    assert.equal(vault.value!.uiAmount, 21000250, "check vault balance");
  });

  it("comet liquidity added!", async () => {
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.addLiquidityToComet(new BN(1000000000), 0);

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
      455061.45546909,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91012.29109402,
      "check iasset pool balance"
    );
  });

  it("comet liquidity subtracted!", async () => {
    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );

    await inceptClient.subtractLiquidityFromComet(new BN(1000000000), 0);

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
      455051.45546909,
      "check usdi pool balance"
    );

    const iassetTokenBalance =
      await inceptClient.connection.getTokenAccountBalance(
        pool.iassetTokenAccount,
        "recent"
      );

    assert.equal(
      iassetTokenBalance.value!.uiAmount,
      91010.29109402,
      "check iasset pool balance"
    );
  });

  it("iasset bought!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    await inceptClient.buySynth(
      new BN(1000000000000),
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      poolIndex
    );

    await sleep(200);

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      48.927648918785,
      "check user usdi balance."
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      11.908970890618,
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
      511223.51081215,
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
      81010.29109402,
      "check pool iAsset"
    );
  });

  it("comet recentered!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];
    const collateral = tokenData.collaterals[0];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    await inceptClient.recenterComet(iassetTokenAccountInfo.address, 0);

    await sleep(200);

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(
        (
          await inceptClient.connection.getTokenAccountBalance(
            collateral.vault,
            "confirmed"
          )
        ).value!.uiAmount
      ),
      21000250,
      "check usdc collateral vault"
    );

    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999750,
      "check user usdc balance"
    );
    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      48.927648918785,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      11.908970890618,
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
      511292.94453873,
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
      80999.28987356,
      "check pool iAsset"
    );
  });

  it("comet closed!", async () => {
    let poolIndex = 0;
    const tokenData = await inceptClient.getTokenData();
    const pool = tokenData.pools[poolIndex];
    const collateral = tokenData.collaterals[0];

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    await inceptClient.closeComet(
      mockUSDCTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      usdiTokenAccountInfo.address,
      0
    );

    await sleep(200);

    mockUSDCTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        mockUSDCMint.publicKey
      );
    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );
    iassetTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        pool.assetInfo.iassetMint
      );

    assert.equal(
      Number(mockUSDCTokenAccountInfo.amount) / 10000000,
      999978999992.3546,
      "check user usdc balance"
    );
    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      48.927648918785,
      "check user usdi balance"
    );
    assert.equal(
      Number(iassetTokenAccountInfo.amount) / 1000000000000,
      11.908970890618,
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
      510731.15630299,
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
      80910.29109382,
      "check pool iAsset"
    );

    const cometPosition = await inceptClient.getCometPosition(0);
    assert.equal(
      Number(cometPosition.collateralAmount.val),
      0,
      "check comet position"
    );
  });

  it("hackathon USDI mint", async () => {
    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );

    const currentUSDI = Number(usdiTokenAccountInfo.amount) / 1000000000000;

    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      50000000000000
    );

    await sleep(200);

    usdiTokenAccountInfo =
      await inceptClient.fetchOrCreateAssociatedTokenAccount(
        inceptClient.manager.usdiMint
      );

    assert.equal(
      Number(usdiTokenAccountInfo.amount) / 1000000000000,
      currentUSDI + 50,
      "usdi not minted properly!"
    );
  });
});
