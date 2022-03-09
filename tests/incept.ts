import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { MockUsdc } from "../sdk/src/idl/mock_usdc";
import { TOKEN_PROGRAM_ID, Token, AccountInfo } from "@solana/spl-token";
import { assert } from "chai";
import { Incept as InceptConnection, TokenData, User, CometPositions, MintPositions, LiquidityPositions, Manager } from "../sdk/src/incept";
import { createPriceFeed, setPrice, getFeedData } from './oracle'
import { Network } from "../sdk/src/network";
import { INCEPT_EXCHANGE_SEED } from "./utils";
import { sleep } from "../sdk/src/utils";


describe("incept", async () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);
  const connection = provider.connection;

  const inceptProgram = anchor.workspace.Incept as Program<Incept>;
  const pythProgram = anchor.workspace.Pyth as Program<Pyth>;
  const mockUSDCProgram = anchor.workspace.MockUsdc as Program<MockUsdc>;

  const RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
  const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

  const walletPubkey = inceptProgram.provider.wallet.publicKey;

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

  const [_exchangeAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
    [INCEPT_EXCHANGE_SEED],
    inceptProgram.programId
  )
  // @ts-expect-error
  let inceptClient = new InceptConnection(
    connection, Network.LOCAL, inceptProgram.provider.wallet, _exchangeAuthority, inceptProgram.programId
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
    await inceptClient.initializeManager(walletPubkey);
  });

  it("user initialized!", async () => {
    await inceptClient.initializeUser(walletPubkey);

    const userAccountData = await inceptClient.getUserAccount(walletPubkey);

    assert(!userAccountData.authority.equals(anchor.web3.PublicKey.default), "check authority address");
    assert(!userAccountData.cometPositions.equals(anchor.web3.PublicKey.default), "check comet position address");
    assert(!userAccountData.mintPositions.equals(anchor.web3.PublicKey.default), "check mint position address");
    assert(!userAccountData.liquidityPositions.equals(anchor.web3.PublicKey.default), "check liquidity position address");

    const cometPositions = await inceptProgram.account.cometPositions.fetch(
      userAccountData.cometPositions
    ) as CometPositions;

    assert(!cometPositions.owner.equals(anchor.web3.PublicKey.default), "check comet positions owner");
    assert(cometPositions.numPositions.eq(new BN(0)), "check num comet positions");
    

    const mintPositions = await inceptProgram.account.mintPositions.fetch(
      userAccountData.mintPositions
    ) as MintPositions;

    assert(!mintPositions.owner.equals(anchor.web3.PublicKey.default), "check mint positions owner");
    assert(mintPositions.numPositions.eq(new BN(0)), "check num mint positions");

    const liquidityPositions = await inceptProgram.account.liquidityPositions.fetch(
      userAccountData.liquidityPositions
    ) as LiquidityPositions;

    assert(!liquidityPositions.owner.equals(anchor.web3.PublicKey.default), "check liquidity positions owner");
    assert(liquidityPositions.numPositions.eq(new BN(0)), "check num liquidity positions");
  });

  it("change feed price", async () => {
    let price = 10;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);

    priceFeed = await createPriceFeed(pythProgram, price, expo, conf);
    console.log("Price " + (await getFeedData(pythProgram, priceFeed)).aggregate.price);

    price = 5;
    await setPrice(pythProgram, price, priceFeed);
    console.log("Updated Price " + (await getFeedData(pythProgram, priceFeed)).aggregate.price);

    // await pythProgram.rpc.initialize(new BN(price * 10 ** -expo), expo, conf, {
    //   accounts: { price: priceFeed },
    //   signers: [priceFeed],
    //   instructions: [
    //     anchor.web3.SystemProgram.createAccount({
    //       fromPubkey: inceptProgram.provider.wallet.publicKey,
    //       newAccountPubkey: priceFeed,
    //       space: 3312,
    //       lamports: await pythProgram.provider.connection.getMinimumBalanceForRentExemption(
    //         3312
    //       ),
    //       programId: pythProgram.programId,
    //     }),
    //   ],
    // });

    // const priceInfo = await pythProgram.provider.connection.getAccountInfo(
    //   priceFeed
    // );

    // let priceData = priceInfo.data.slice(208, 240);

    // const priceComponent = priceData.readBigUInt64LE(0);
    // const onchainPrice = Number(priceComponent) * 10 ** expo;

    // console.log("Initial Price " + onchainPrice);

    // const newPrice = 5;

    // await pythProgram.rpc.setPrice(new BN(newPrice * 10 ** -expo), {
    //   accounts: { price: priceFeed },
    // });

    // const newPriceInfo = await pythProgram.provider.connection.getAccountInfo(
    //   priceFeed
    // );

    // let newPriceData = newPriceInfo.data.slice(208, 240);

    // const newPriceComponent = newPriceData.readBigUInt64LE(0);
    // const newOnchainPrice = Number(newPriceComponent) * 10 ** expo;

    // console.log("Updated Price " + newOnchainPrice);
  });

  it("mock usdc added as a collateral!", async () => {
    await inceptClient.addCollateral(
      walletPubkey, 7, 1, mockUSDCMint.publicKey
    );
    await sleep(200);
  });

  it("pool initialized!", async () => {
    await inceptClient.initializePool(
      walletPubkey, 150, 200, priceFeed
    );
  });

  it("token data initialization check", async () => {

    const tokenData = await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as TokenData;
    
    assert(tokenData.manager.equals(inceptClient.managerAddress[0]), "wrong manager!");
    assert(tokenData.numPools.eq(new BN(1)), "num pools incorrect");
    assert(tokenData.numCollaterals.eq(new BN(1)), "num collaterals incorrect");

    const first_pool = tokenData.pools[0];
    assert(!first_pool.iassetTokenAccount.equals(anchor.web3.PublicKey.default), "check iassetTokenAccount");
    assert(!first_pool.usdiTokenAccount.equals(anchor.web3.PublicKey.default), "check iassetTokenAccount");
    assert(!first_pool.liquidityTokenMint.equals(anchor.web3.PublicKey.default), "check iassetTokenAccount");
    assert(!first_pool.liquidationIassetTokenAccount.equals(anchor.web3.PublicKey.default), "check iassetTokenAccount");
    assert(!first_pool.cometLiquidityTokenAccount.equals(anchor.web3.PublicKey.default), "check iassetTokenAccount");
    
    const assetInfo = first_pool.assetInfo;

    var valueToDecimal = function(value): Number {
      return Number(value.val) * 10 **(-Number(value.scale))
    };

    assert(assetInfo.priceFeedAddress.equals(priceFeed), "check price feed");
    assert.equal(valueToDecimal(assetInfo.stableCollateralRatio), 1.5, "stable collateral ratio incorrect");
    assert.equal(valueToDecimal(assetInfo.cryptoCollateralRatio), 2,  "crypto collateral ratio incorrect");

    const first_collateral = tokenData.collaterals[0];
    assert(!first_collateral.mint.equals(anchor.web3.PublicKey.default), "check mint address");
    assert(!first_collateral.vault.equals(anchor.web3.PublicKey.default)), "check vault address";
  });

  it("price updated!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];
    await inceptClient.updatePrices(signers);
    await sleep(200);
  });

  const mockUSDC = new Token(
    connection,
    mockUSDCMint.publicKey,
    TOKEN_PROGRAM_ID,
    // @ts-ignore
    provider.wallet.payer
  );

  it("mock usdc minted!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
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
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 1000000000000, "check USDC amount");
  });

  let usdi: Token;

  it("usdi minted!", async () => {

    usdi = new Token(
      connection,
      inceptClient.manager.usdiMint,
      TOKEN_PROGRAM_ID,
      // @ts-ignore
      provider.wallet.payer
    );

    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.mintUsdi(
      new BN(100000000000000),
      walletPubkey, 
      usdiTokenAccountInfo.address,
      mockUSDCTokenAccountInfo.address,
      0,
      signers
    );

    await sleep(200);

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    assert.equal(usdiTokenAccountInfo.amount / 1000000000000, 100, "check iasset token amount");
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999999999900, "check USDC amount");

    const tokenData = await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as TokenData;

    const vault = await connection.getTokenAccountBalance(tokenData.collaterals[0].vault, "confirmed");
    assert.equal(vault.value!.uiAmount, 100, "check usdc vault amount");
  });

  let iasset;

  it("iasset minted!", async () => {

    const tokenData = await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as TokenData;
    const pool = tokenData.pools[0];

    iasset = new Token(
      connection,
      pool.assetInfo.iassetMint,
      TOKEN_PROGRAM_ID,
      // @ts-ignore
      provider.wallet.payer
    );

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;

    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.initializeMintPositions(
      new BN(20000000000000),
      new BN(200000000000000),
      walletPubkey,
      mockUSDCTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      0,
      0,
      signers
    );

    await sleep(200);

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;
      
    assert.equal(iassetTokenAccountInfo.amount / 1000000000000, 20, "check iasset token amount");
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999979999900, "check USDC amount");

    const vault = await connection.getTokenAccountBalance(tokenData.collaterals[0].vault, "confirmed");
    assert.equal(vault.value!.uiAmount, 20000100, "check usdc vault amount");

  });

  it("mint collateral added!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;

    await inceptClient.addCollateralToMint(
      walletPubkey,
      mockUSDCTokenAccountInfo.address,
      new BN(1000000000),
      0,
      signers
    );

    await sleep(200);

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;
      
    assert.equal(iassetTokenAccountInfo.amount / 1000000000000, 20, "check iasset token amount");
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999979999800.0001, "check USDC amount");
    
    const tokenData = await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as TokenData;

    const vault = await connection.getTokenAccountBalance(tokenData.collaterals[0].vault, "confirmed");
    assert.equal(vault.value!.uiAmount, 20000200, "check usdc vault amount");

  });

  it("mint collateral removed!", async () => {
    // @ts-ignore
    let signers: Array<Signer> = [provider.wallet.payer];

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptClient.withdrawCollateralFromMint(
      walletPubkey,
      mockUSDCTokenAccountInfo.address,
      new BN(1000000000),
      0,
      signers
    );

    await sleep(200);

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    ) as AccountInfo;

    assert.equal(iassetTokenAccountInfo.amount / 1000000000000, 20, "check iasset token amount");
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999979999900, "check USDC amount");

    const tokenData = await inceptProgram.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as TokenData;

    const vault = await connection.getTokenAccountBalance(tokenData.collaterals[0].vault, "confirmed");
    assert.equal(vault.value!.uiAmount, 20000100, "check usdc vault amount");

  });

  // it("iasset burned!", async () => {
  //   mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.payBackMint(
  //     managerAccount[1],
  //     userAccount[1],
  //     new BN(0),
  //     new BN(5000000),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         userAccount: userAccount[0],
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         mintPositions: mintPositionsAccount.publicKey,
  //         iassetMint: iassetMint.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  // });

  // it("iasset reminted!", async () => {
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   let priceUpdateIx = inceptProgram.instruction.updatePrices(
  //     managerAccount[1],
  //     {
  //       remainingAccounts: [
  //         { isSigner: false, isWritable: false, pubkey: priceFeed },
  //       ],
  //       accounts: {
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //       },
  //     }
  //   );

  //   let addIassetToMintIx = inceptProgram.instruction.addIassetToMint(
  //     managerAccount[1],
  //     userAccount[1],
  //     new BN(0),
  //     new BN(5000000),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         userAccount: userAccount[0],
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         mintPositions: mintPositionsAccount.publicKey,
  //         iassetMint: iassetMint.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );
  //   let tx = new anchor.web3.Transaction()
  //     .add(priceUpdateIx)
  //     .add(addIassetToMintIx);
  //   let signers = [provider.wallet.payer];
  //   tx.setSigners(...signers.map((s) => s.publicKey));
  //   tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
  //   tx.feePayer = walletPubkey;
  //   tx.partialSign(...signers);
  //   let signedTransaction = await connection.sendRawTransaction(tx.serialize());
  //   await connection.confirmTransaction(signedTransaction);

  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  // });

  let liquidityToken;

  it("liquidity position initialized!", async () => {

    // const tokenData = await inceptProgram.account.tokenData.fetch(
    //   inceptClient.manager.tokenData
    // ) as TokenData;
    const tokenData = await inceptClient.getTokenData();

    const firstPool = tokenData.pools[0];

    liquidityToken = new Token(
      connection,
      firstPool.liquidityTokenMint,
      TOKEN_PROGRAM_ID,
      // @ts-ignore
      provider.wallet.payer
    );

    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    // @ts-ignore
    const signers: Array<Signer> = [provider.wallet.payer];

    await inceptClient.initializeLiquidityPosition(
      new BN(10000000000000),
      walletPubkey,
      usdiTokenAccountInfo.address,
      iassetTokenAccountInfo.address,
      liquidityTokenAccountInfo.address,
      0,
      signers
    );

    await sleep(200);

    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    assert.equal(usdiTokenAccountInfo.amount / 1000000000000, 50, "check usdi");
    assert.equal(iassetTokenAccountInfo.amount / 1000000000000, 10, "check iasset");
    assert.equal(liquidityTokenAccountInfo.amount / 1000000000000, 500, "check liquidity tokens");

    const usdiAccountBalance = await connection.getTokenAccountBalance(firstPool.usdiTokenAccount, "confirmed");
    assert.equal(usdiAccountBalance.value!.uiAmount, 50, "check usdi account balance");

    const iassetAccountBalance = await connection.getTokenAccountBalance(firstPool.iassetTokenAccount, "confirmed");
    assert.equal(iassetAccountBalance.value!.uiAmount, 10, "check iasset account balance");

  });

  // it("liquidity provided!", async () => {
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.provideLiquidity(
  //     managerAccount[1],
  //     new BN(0),
  //     new BN(100000000),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         liquidityPositions: liquidityPositionsAccount.publicKey,
  //         userUsdiTokenAccount: usdiTokenAccountInfo.address,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         userLiquidityTokenAccount: liquidityTokenAccountInfo.address,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         liquidityTokenMint: liquidityTokenMintAccount.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDI."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(liquidityTokenAccountInfo.amount / 1000000000000) +
  //       " liquidity tokens."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  // });

  // it("liquidity withdrawn!", async () => {
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.withdrawLiquidity(
  //     managerAccount[1],
  //     new BN(0),
  //     new BN(45453545454500),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         liquidityPositions: liquidityPositionsAccount.publicKey,
  //         userUsdiTokenAccount: usdiTokenAccountInfo.address,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         userLiquidityTokenAccount: liquidityTokenAccountInfo.address,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         liquidityTokenMint: liquidityTokenMintAccount.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDI."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(liquidityTokenAccountInfo.amount / 1000000000000) +
  //       " liquidity tokens."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  // });

  // it("iasset bought!", async () => {
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.buySynth(
  //     managerAccount[1],
  //     new BN(0),
  //     new BN(50000000),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         userUsdiTokenAccount: usdiTokenAccountInfo.address,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDI."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  // });

  // it("iasset sold!", async () => {
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.sellSynth(
  //     managerAccount[1],
  //     new BN(0),
  //     new BN(50000000),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         userUsdiTokenAccount: usdiTokenAccountInfo.address,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDI."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  // });

  it("comet initialized!", async () => {

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    
    // @ts-ignore
    const signers = [provider.wallet.payer];

    await inceptClient.initializeComet(
      walletPubkey,
      mockUSDCTokenAccountInfo.address,
      new BN(25000000),
      new BN(5000000000000),
      0,
      0,
      signers
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const firstPool = tokenData.pools[0];
    const firstCollateral = tokenData.collaterals[0];
    
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999979999897.5, "check user USDI");

    const usdiAccountBalance = await connection.getTokenAccountBalance(
      firstPool.usdiTokenAccount,
      "confirmed"
    );

    assert.equal(usdiAccountBalance.value!.uiAmount, 55, "check usdi account balance");

    const iassetTokenBalance = await connection.getTokenAccountBalance(
      firstPool.iassetTokenAccount,
      "confirmed"
    );

    assert.equal(iassetTokenBalance.value!.uiAmount, 11, "check iasset balance");

    const vault = await connection.getTokenAccountBalance(
      firstCollateral.vault,
      "confirmed"
    );

    assert.equal(vault.value!.uiAmount, 20000102.5, "check vault balance");

  });

  it("comet collateral added!", async () => {

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    // @ts-ignore
    const signers = [provider.wallet.payer];

    await inceptClient.addCollateralToComet(
      walletPubkey,
      mockUSDCTokenAccountInfo.address,
      new BN(5000000),
      0,
      signers
    );

    await sleep(200);
    
    const tokenData = await inceptClient.getTokenData();
    const firstPool = tokenData.pools[0];
    const firstCollateral = tokenData.collaterals[0];
    
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999979999896.9999, "check user USDI");

    const usdiAccountBalance = await connection.getTokenAccountBalance(
      firstPool.usdiTokenAccount,
      "confirmed"
    );

    assert.equal(usdiAccountBalance.value!.uiAmount, 55, "check usdi account balance");

    const iassetTokenBalance = await connection.getTokenAccountBalance(
      firstPool.iassetTokenAccount,
      "confirmed"
    );

    assert.equal(iassetTokenBalance.value!.uiAmount, 11, "check iasset balance");

    const vault = await connection.getTokenAccountBalance(
      firstCollateral.vault,
      "confirmed"
    );

    assert.equal(vault.value!.uiAmount, 20000103, "check vault balance");

  });

  it("comet collateral withdrawn!", async () => {

    // @ts-ignore
    const signers = [provider.wallet.payer];

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptClient.withdrawCollateralFromComet(
      walletPubkey,
      mockUSDCTokenAccountInfo.address,
      new BN(5000000),
      0,
      signers
    );

    await sleep(200);

    const tokenData = await inceptClient.getTokenData();
    const firstPool = tokenData.pools[0];
    const firstCollateral = tokenData.collaterals[0];
    
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    assert.equal(mockUSDCTokenAccountInfo.amount / 10000000, 999979999897.5, "check user USDI");

    const usdiAccountBalance = await connection.getTokenAccountBalance(
      firstPool.usdiTokenAccount,
      "confirmed"
    );

    assert.equal(usdiAccountBalance.value!.uiAmount, 55, "check usdi account balance");

    const iassetTokenBalance = await connection.getTokenAccountBalance(
      firstPool.iassetTokenAccount,
      "confirmed"
    );

    assert.equal(iassetTokenBalance.value!.uiAmount, 11, "check iasset balance");

    const vault = await connection.getTokenAccountBalance(
      firstCollateral.vault,
      "confirmed"
    );

    assert.equal(vault.value!.uiAmount, 20000102.5, "check vault balance");

  });

  // it("iasset bought!", async () => {
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.buySynth(
  //     managerAccount[1],
  //     new BN(0),
  //     new BN(20000000000000),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         userUsdiTokenAccount: usdiTokenAccountInfo.address,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDI."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  // });

  // it("comet closed!", async () => {
  //   mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   await inceptProgram.rpc.closeComet(
  //     managerAccount[1],
  //     userAccount[1],
  //     new BN(0),
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         userAccount: userAccount[0],
  //         usdiMint: usdiMint.publicKey,
  //         iassetMint: iassetMint.publicKey,
  //         userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         userUsdiTokenAccount: usdiTokenAccountInfo.address,
  //         cometPositions: cometPositionsAccount.publicKey,
  //         cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         liquidityTokenMint: liquidityTokenMintAccount.publicKey,
  //         vault: mockUSDCVault.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "User now has " +
  //       Number(mockUSDCTokenAccountInfo.amount / 10000000) +
  //       " USDC."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDi."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  //   const cometPositions = await inceptProgram.account.cometPositions.fetch(
  //     cometPositionsAccount.publicKey
  //   );
  //   console.log("comet Position");
  //   console.log(cometPositions.cometPositions[0]);
  // });

  it("comet recentered!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    // @ts-ignore
    const signers = [provider.wallet.payer];

    await inceptClient.recenterComet(
      walletPubkey,
      iassetTokenAccountInfo.address,
      0,
      signers
    )

  //   await inceptProgram.rpc.recenterComet(
  //     managerAccount[1],
  //     userAccount[1],
  //     0,
  //     {
  //       accounts: {
  //         user: walletPubkey,
  //         manager: managerAccount[0],
  //         tokenData: tokenDataAccount.publicKey,
  //         usdiMint: usdiMint.publicKey,
  //         iassetMint: iassetMint.publicKey,
  //         userIassetTokenAccount: iassetTokenAccountInfo.address,
  //         cometPositions: cometPositionsAccount.publicKey,
  //         ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
  //         ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
  //         liquidityTokenMint: liquidityTokenMintAccount.publicKey,
  //         vault: mockUSDCVault.publicKey,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //     }
  //   );

  //   await new Promise((resolve) => setTimeout(resolve, 200));

  //   mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );
  //   iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
  //     walletPubkey
  //   );

  //   console.log(
  //     "Mock USDC collateral vault now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             mockUSDCVault.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDC."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(mockUSDCTokenAccountInfo.amount / 10000000) +
  //       " USDC."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(usdiTokenAccountInfo.amount / 1000000000000) +
  //       " USDi."
  //   );
  //   console.log(
  //     "User now has " +
  //       Number(iassetTokenAccountInfo.amount / 1000000000000) +
  //       " iAsset."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             usdiPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " USDI."
  //   );
  //   console.log(
  //     "Market 0 now has " +
  //       Number(
  //         (
  //           await connection.getTokenAccountBalance(
  //             iAssetPoolTokenAccount.publicKey,
  //             "confirmed"
  //           )
  //         ).value!.uiAmount
  //       ) +
  //       " iAsset."
  //   );
  });

  it("hackathon USDI mint", async () => {

    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    const currentUSDI = usdiTokenAccountInfo.amount / 1000000000000;

    await inceptClient.hackathonMintUsdi(
      usdiTokenAccountInfo.address,
      50000000000000,
      // @ts-ignore
      [provider.wallet.payer]
    )

    await sleep(200);

    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    assert.equal(usdiTokenAccountInfo.amount / 1000000000000, currentUSDI + 50, "usdi not minted properly!");

  });
});
