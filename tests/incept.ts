import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../sdk/src/idl/incept";
import { Pyth } from "../sdk/src/idl/pyth";
import { MockUsdc } from "../sdk/src/idl/mock_usdc";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from "chai";
import { Incept as InceptConnection, TokenData, User, CometPositions, MintPositions, LiquidityPositions } from "../sdk/src/incept";
import { createPriceFeed, setPrice, getFeedData } from './oracle'
import { Network } from "../sdk/src/network";
import { INCEPT_EXCHANGE_SEED } from "./utils";


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
  const mockUSDCVault = anchor.web3.Keypair.generate();

  const managerAccount = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("manager")],
    inceptProgram.programId
  );
  const tokenDataAccount = anchor.web3.Keypair.generate();
  const TOKEN_DATA_SIZE = 130608 + 8;//130608;

  const liquidatedCometUSDITokenAccount = anchor.web3.Keypair.generate();
  const usdiMint = anchor.web3.Keypair.generate();

  const userAccount = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("user"), walletPubkey.toBuffer()],
    inceptProgram.programId
  );
  const cometPositionsAccount = anchor.web3.Keypair.generate();
  const COMET_POSITIONS_SIZE = 59200 + 8;// 55128;
  const mintPositionsAccount = anchor.web3.Keypair.generate();
  const MINT_POSITIONS_SIZE = 24520 + 8;// 22488;
  const liquidityPositionsAccount = anchor.web3.Keypair.generate();
  const LIQUIDITY_POSITIONS_SIZE = 16360 + 8;//16368;

  let priceFeed;

  const usdiPoolTokenAccount = anchor.web3.Keypair.generate();
  const iassetMint = anchor.web3.Keypair.generate();
  const iAssetPoolTokenAccount = anchor.web3.Keypair.generate();
  const iAssetLiquidationTokenAccount = anchor.web3.Keypair.generate();
  const liquidityTokenMintAccount = anchor.web3.Keypair.generate();
  const cometLiquidityTokenAccount = anchor.web3.Keypair.generate();

  let mockUSDCTokenAccountInfo;
  let usdiTokenAccountInfo;
  let iassetTokenAccountInfo;
  let liquidityTokenAccountInfo;

  console.log(provider.wallet);

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
    // await inceptProgram.rpc.initializeUser(managerAccount[1], userAccount[1], {
    //   accounts: {
    //     user: walletPubkey,
    //     manager: managerAccount[0],
    //     userAccount: userAccount[0],
    //     cometPositions: cometPositionsAccount.publicKey,
    //     mintPositions: mintPositionsAccount.publicKey,
    //     liquidityPositions: liquidityPositionsAccount.publicKey,
    //     usdiMint: usdiMint.publicKey,
    //     rent: RENT_PUBKEY,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //     systemProgram: SYSTEM_PROGRAM_ID,
    //   },
    //   instructions: [
    //     await inceptProgram.account.cometPositions.createInstruction(
    //       cometPositionsAccount,
    //       COMET_POSITIONS_SIZE
    //     ),
    //     await inceptProgram.account.mintPositions.createInstruction(
    //       mintPositionsAccount,
    //       MINT_POSITIONS_SIZE
    //     ),
    //     await inceptProgram.account.liquidityPositions.createInstruction(
    //       liquidityPositionsAccount,
    //       LIQUIDITY_POSITIONS_SIZE
    //     ),
    //   ],
    //   signers: [
    //     cometPositionsAccount,
    //     mintPositionsAccount,
    //     liquidityPositionsAccount,
    //   ],
    // });
    // TEST USER ACCOUNT DATA.
    const userAccountdata = await inceptProgram.account.user.fetch(
      userAccount[0]
    ) as User;

    console.log("TESTING USER ACCCOUNT")
    console.log(`AUTHORITY: ${userAccountdata.authority.toString()} vs ${walletPubkey.toString()}`);
    console.log(`COMET POSITIONS: ${userAccountdata.cometPositions.toString()} vs ${cometPositionsAccount.publicKey.toString()}`);
    console.log(`MINT POSITIONS: ${userAccountdata.mintPositions.toString()} vs ${mintPositionsAccount.publicKey.toString()}`);
    console.log(`LIQUIDITY POSITIONS: ${userAccountdata.liquidityPositions.toString()} vs ${liquidityPositionsAccount.publicKey.toString()}`);

    const cometPositions = await inceptProgram.account.cometPositions.fetch(
      userAccountdata.cometPositions
    ) as CometPositions;
    console.log("COMET POSITIONS:");
    console.log(`OWNER: ${cometPositions.owner.toString()} POSITIONS: ${cometPositions.numPositions}`)
    console.log(cometPositions.cometPositions[0]);

    const mintPositions = await inceptProgram.account.mintPositions.fetch(
      userAccountdata.mintPositions
    ) as MintPositions;
    console.log("MINT POSITIONS:");
    console.log(`OWNER: ${mintPositions.owner.toString()} POSITIONS: ${mintPositions.numPositions}`)
    console.log(mintPositions.mintPositions[0]);

    const liquidityPositions = await inceptProgram.account.liquidityPositions.fetch(
      userAccountdata.liquidityPositions
    ) as LiquidityPositions;
    console.log("LIQUIDITY POSITIONS:");
    console.log(`OWNER: ${liquidityPositions.owner.toString()} POSITIONS: ${liquidityPositions.numPositions}`)
    console.log(liquidityPositions.liquidityPositions[0]);

    await inceptClient.initializeUser(walletPubkey);
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
    // @ts-ignore
    let tokenData = await inceptClient.program.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as unknown as TokenData;
    console.log("BEFORE ADD COLLATERAL:");
    console.log(`${tokenData.manager} ${tokenData.numCollaterals} ${tokenData.numPools}`);
    console.log("FIRST COLLATERAL");
    console.log(tokenData.collaterals[0])

    // ADD COLLATERAL
    await inceptClient.addCollateral(
      walletPubkey, 7, 1, mockUSDCMint.publicKey
    );


    const managerAccount = await inceptClient.getManagerAccount();
    
    await new Promise((resolve) => setTimeout(resolve, 200));
    // @ts-ignore
    tokenData = await inceptClient.program.account.tokenData.fetch(
      inceptClient.manager.tokenData
    ) as unknown as TokenData;

    console.log("AFTER ADD COLLATERAL:");
    console.log(`${tokenData.manager} ${tokenData.numCollaterals} ${tokenData.numPools}`);
    console.log("FIRST COLLATERAL");
    console.log(tokenData.collaterals[0])
    console.log("FIRST POOL");
    console.log(tokenData.pools[0])
    // const currentTokenData = await connection.getAccountInfo(
    //   managerAccount.tokenData
    // ) as unknown as TokenData;
    // console.log(`TOKEN DATA: ${currentTokenData}`);
  });

  it("pool initialized!", async () => {
    await inceptClient.initializePool(
      walletPubkey, 150, 200, priceFeed
    );
    const tokenData = await inceptProgram.account.tokenData.fetch(
      tokenDataAccount.publicKey
    ) as TokenData;

    console.log(`MANAGER ADDRESS: ${tokenData.manager.toString()} vs ${inceptClient.managerAddress.toString()}`);
    console.log(`NUM POOLS: ${tokenData.numPools}`);
    console.log(`NUM COLLATERALS: ${tokenData.numCollaterals}`);
    console.log(`iassetTokenAccount: ${tokenData.pools[0].iassetTokenAccount.toString()}`)
    console.log(`usdiTokenAccount: ${tokenData.pools[0].usdiTokenAccount.toString()}`)
    console.log(`liquidityTokenMint: ${tokenData.pools[0].liquidityTokenMint.toString()}`)
    console.log(`liquidationIassetTokenAccount: ${tokenData.pools[0].liquidationIassetTokenAccount.toString()}`)
    console.log(`cometLiquidityTokenAccount: ${tokenData.pools[0].cometLiquidityTokenAccount.toString()}`)
    
    const assetInfo = tokenData.pools[0].assetInfo;
    var valueToDecimal = function(value): Number {
      return Number(value.val) * 10 **(-Number(value.scale))
    };
    console.log(`stable collateral ratio: ${valueToDecimal(assetInfo.stableCollateralRatio)}`);
    console.log(`crypto collateral ratio: ${valueToDecimal(assetInfo.cryptoCollateralRatio)}`);

    console.log(`mint: ${tokenData.collaterals[0].mint.toString()}`);
    console.log(`vault: ${tokenData.collaterals[0].vault.toString()}`);
    console.log(tokenData.collaterals[0]);
  });

  it("price updated!", async () => {
    await inceptClient.updatePrices([]);
    await new Promise((resolve) => setTimeout(resolve, 200));
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
    console.log(
      "User now has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC minted."
    );
  });

  const usdi = new Token(
    connection,
    usdiMint.publicKey,
    TOKEN_PROGRAM_ID,
    // @ts-ignore
    provider.wallet.payer
  );

  it("usdi minted!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.mintUsdi(
      managerAccount[1],
      new BN(100000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          usdiMint: usdiMint.publicKey,
          userUsdiTokenAccount: usdiTokenAccountInfo.address,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    console.log(
      "User has just minted " +
        Number(usdiTokenAccountInfo.amount / 1000000000000) +
        " USDI."
    );
    console.log(
      "User has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC remaining."
    );
    console.log(
      "Mock USDC collateral vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC."
    );
  });

  const iasset = new Token(
    connection,
    iassetMint.publicKey,
    TOKEN_PROGRAM_ID,
    // @ts-ignore
    provider.wallet.payer
  );

  it("iasset minted!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    let priceUpdateIx = inceptProgram.instruction.updatePrices(
      managerAccount[1],
      {
        remainingAccounts: [
          { isSigner: false, isWritable: false, pubkey: priceFeed },
        ],
        accounts: {
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
        },
      }
    );

    let initializeMintPositionIx = inceptProgram.instruction.initializeMintPosition(
      managerAccount[1],
      userAccount[1],
      new BN(20000000000000),
      new BN(200000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          mintPositions: mintPositionsAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          iassetMint: iassetMint.publicKey,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          oracle: priceFeed,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
    let tx = new anchor.web3.Transaction()
      .add(priceUpdateIx)
      .add(initializeMintPositionIx);
      // @ts-ignore
    let signers = [provider.wallet.payer];
    tx.setSigners(...signers.map((s) => s.publicKey));
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = walletPubkey;
    tx.partialSign(...signers);
    let signedTransaction = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signedTransaction);

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    console.log(
      "User now has " +
        Number(iassetTokenAccountInfo.amount / 1000000000000) +
        " iAsset."
    );
    console.log(
      "User has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC remaining."
    );
    console.log(
      "Mock USDC collateral vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC locked."
    );
  });

  it("mint collateral added!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.addCollateralToMint(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(1000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          mintPositions: mintPositionsAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC remaining."
    );
    console.log(
      "Mock USDC collateral vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC locked."
    );
  });

  it("mint collateral removed!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    let priceUpdateIx = inceptProgram.instruction.updatePrices(
      managerAccount[1],
      {
        remainingAccounts: [
          { isSigner: false, isWritable: false, pubkey: priceFeed },
        ],
        accounts: {
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
        },
      }
    );

    let removeCollateralFromMintIx = inceptProgram.instruction.withdrawCollateralFromMint(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(1000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          mintPositions: mintPositionsAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
    let tx = new anchor.web3.Transaction()
      .add(priceUpdateIx)
      .add(removeCollateralFromMintIx);
    // @ts-ignore
    let signers = [provider.wallet.payer];
    tx.setSigners(...signers.map((s) => s.publicKey));
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    tx.feePayer = walletPubkey;
    tx.partialSign(...signers);
    let signedTransaction = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signedTransaction);

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC remaining."
    );
    console.log(
      "Mock USDC collateral vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC locked."
    );
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

  const liquidityToken = new Token(
    connection,
    liquidityTokenMintAccount.publicKey,
    TOKEN_PROGRAM_ID,
    // @ts-ignore
    provider.wallet.payer
  );

  it("liquidity position initialized!", async () => {
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.initializeLiquidityPosition(
      managerAccount[1],
      new BN(0),
      new BN(10000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          liquidityPositions: liquidityPositionsAccount.publicKey,
          userUsdiTokenAccount: usdiTokenAccountInfo.address,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          userLiquidityTokenAccount: liquidityTokenAccountInfo.address,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User now has " +
        Number(usdiTokenAccountInfo.amount / 1000000000000) +
        " USDI."
    );
    console.log(
      "User now has " +
        Number(iassetTokenAccountInfo.amount / 1000000000000) +
        " iAsset."
    );
    console.log(
      "User now has " +
        Number(liquidityTokenAccountInfo.amount / 1000000000000) +
        " liquidity tokens."
    );
    console.log(
      "Market 0 now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              usdiPoolTokenAccount.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDI."
    );
    console.log(
      "Market 0 now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              iAssetPoolTokenAccount.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " iAsset."
    );
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

    await inceptProgram.rpc.initializeComet(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(25000000),
      new BN(5000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          usdiMint: usdiMint.publicKey,
          iassetMint: iassetMint.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          cometPositions: cometPositionsAccount.publicKey,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User now has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC."
    );
    console.log(
      "Market 0 now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              usdiPoolTokenAccount.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDI."
    );
    console.log(
      "Market 0 now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              iAssetPoolTokenAccount.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " iAsset."
    );
    console.log(
      "Mock USDC vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC locked."
    );
  });

  it("comet collateral added!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.addCollateralToComet(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(5000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          cometPositions: cometPositionsAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User now has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC."
    );
    console.log(
      "Mock USDC vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC locked."
    );

    // TEST USER ACCOUNT DATA.
    const userAccountdata = await inceptProgram.account.user.fetch(
      userAccount[0]
    ) as User;

    console.log("TESTING USER ACCCOUNT AFTER COMET")
    console.log(`AUTHORITY: ${userAccountdata.authority.toString()} vs ${walletPubkey.toString()}`);
    console.log(`COMET POSITIONS: ${userAccountdata.cometPositions.toString()} vs ${cometPositionsAccount.publicKey.toString()}`);
    console.log(`MINT POSITIONS: ${userAccountdata.mintPositions.toString()} vs ${mintPositionsAccount.publicKey.toString()}`);
    console.log(`LIQUIDITY POSITIONS: ${userAccountdata.liquidityPositions.toString()} vs ${liquidityPositionsAccount.publicKey.toString()}`);

    const cometPositions = await inceptProgram.account.cometPositions.fetch(
      userAccountdata.cometPositions
    ) as CometPositions;
    console.log("COMET POSITIONS:");
    console.log(`OWNER: ${cometPositions.owner.toString()} POSITIONS: ${cometPositions.numPositions}`)
    console.log(cometPositions.cometPositions[0]);

    const mintPositions = await inceptProgram.account.mintPositions.fetch(
      userAccountdata.mintPositions
    ) as MintPositions;
    console.log("MINT POSITIONS:");
    console.log(`OWNER: ${mintPositions.owner.toString()} POSITIONS: ${mintPositions.numPositions}`)
    console.log(mintPositions.mintPositions[0]);

    const liquidityPositions = await inceptProgram.account.liquidityPositions.fetch(
      userAccountdata.liquidityPositions
    ) as LiquidityPositions;
    console.log("LIQUIDITY POSITIONS:");
    console.log(`OWNER: ${liquidityPositions.owner.toString()} POSITIONS: ${liquidityPositions.numPositions}`)
    console.log(liquidityPositions.liquidityPositions[0]);

  
  });

  it("comet collateral withdrawn!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.withdrawCollateralFromComet(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(5000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          cometPositions: cometPositionsAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User now has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC."
    );
    console.log(
      "Mock USDC vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC locked."
    );
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

    await inceptProgram.rpc.recenterComet(
      managerAccount[1],
      userAccount[1],
      0,
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          usdiMint: usdiMint.publicKey,
          iassetMint: iassetMint.publicKey,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          cometPositions: cometPositionsAccount.publicKey,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "Mock USDC collateral vault now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              mockUSDCVault.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDC."
    );
    console.log(
      "User now has " +
        Number(mockUSDCTokenAccountInfo.amount / 10000000) +
        " USDC."
    );
    console.log(
      "User now has " +
        Number(usdiTokenAccountInfo.amount / 1000000000000) +
        " USDi."
    );
    console.log(
      "User now has " +
        Number(iassetTokenAccountInfo.amount / 1000000000000) +
        " iAsset."
    );
    console.log(
      "Market 0 now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              usdiPoolTokenAccount.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " USDI."
    );
    console.log(
      "Market 0 now has " +
        Number(
          (
            await connection.getTokenAccountBalance(
              iAssetPoolTokenAccount.publicKey,
              "confirmed"
            )
          ).value!.uiAmount
        ) +
        " iAsset."
    );
  });
});
