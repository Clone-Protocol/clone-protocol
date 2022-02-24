import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
import { Incept } from "../target/types/incept";
import { Pyth } from "../target/types/pyth";
import { MockUsdc } from "../target/types/mock_usdc";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from "chai";
import { TokenData, Collateral } from "../sdk/src/incept";

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
  const TOKEN_DATA_SIZE = 130608;

  const liquidatedCometUSDITokenAccount = anchor.web3.Keypair.generate();
  const usdiMint = anchor.web3.Keypair.generate();

  const userAccount = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("user"), walletPubkey.toBuffer()],
    inceptProgram.programId
  );
  const cometPositionsAccount = anchor.web3.Keypair.generate();
  const COMET_POSITIONS_SIZE = 46968;
  const mintPositionsAccount = anchor.web3.Keypair.generate();
  const MINT_POSITIONS_SIZE = 22488;

  const priceFeed = anchor.web3.Keypair.generate();

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
    await inceptProgram.rpc.initializeManager(managerAccount[1], {
      accounts: {
        admin: walletPubkey,
        manager: managerAccount[0],
        usdiMint: usdiMint.publicKey,
        liquidatedCometUsdiTokenAccount:
          liquidatedCometUSDITokenAccount.publicKey,
        tokenData: tokenDataAccount.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      instructions: [
        await inceptProgram.account.tokenData.createInstruction(
          tokenDataAccount,
          TOKEN_DATA_SIZE
        ),
      ],
      signers: [usdiMint, tokenDataAccount, liquidatedCometUSDITokenAccount],
    });
  });

  it("user initialized!", async () => {
    await inceptProgram.rpc.initializeUser(managerAccount[1], userAccount[1], {
      accounts: {
        user: walletPubkey,
        manager: managerAccount[0],
        userAccount: userAccount[0],
        cometPositions: cometPositionsAccount.publicKey,
        mintPositions: mintPositionsAccount.publicKey,
        usdiMint: usdiMint.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      instructions: [
        await inceptProgram.account.cometPositions.createInstruction(
          cometPositionsAccount,
          55128
        ),
        await inceptProgram.account.mintPositions.createInstruction(
          mintPositionsAccount,
          22488
        ),
      ],
      signers: [cometPositionsAccount, mintPositionsAccount],
    });
  });

  it("change feed price", async () => {
    const price = 20;
    const expo = -7;

    const conf = new BN((price / 10) * 10 ** -expo);

    await pythProgram.rpc.initialize(new BN(price * 10 ** -expo), expo, conf, {
      accounts: { price: priceFeed.publicKey },
      signers: [priceFeed],
      instructions: [
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: inceptProgram.provider.wallet.publicKey,
          newAccountPubkey: priceFeed.publicKey,
          space: 3312,
          lamports: await pythProgram.provider.connection.getMinimumBalanceForRentExemption(
            3312
          ),
          programId: pythProgram.programId,
        }),
      ],
    });

    const priceInfo = await pythProgram.provider.connection.getAccountInfo(
      priceFeed.publicKey
    );

    let priceData = priceInfo.data.slice(208, 240);

    const priceComponent = priceData.readBigUInt64LE(0);
    const onchainPrice = Number(priceComponent) * 10 ** expo;

    console.log("Initial Price " + onchainPrice);

    const newPrice = 15;

    await pythProgram.rpc.setPrice(new BN(newPrice * 10 ** -expo), {
      accounts: { price: priceFeed.publicKey },
    });

    const newPriceInfo = await pythProgram.provider.connection.getAccountInfo(
      priceFeed.publicKey
    );

    let newPriceData = newPriceInfo.data.slice(208, 240);

    const newPriceComponent = newPriceData.readBigUInt64LE(0);
    const newOnchainPrice = Number(newPriceComponent) * 10 ** expo;

    console.log("Updated Price " + newOnchainPrice);
  });

  it("mock usdc added as a collateral!", async () => {
    await inceptProgram.rpc.addCollateral(managerAccount[1], 7, 1, {
      accounts: {
        admin: walletPubkey,
        manager: managerAccount[0],
        tokenData: tokenDataAccount.publicKey,
        collateralMint: mockUSDCMint.publicKey,
        vault: mockUSDCVault.publicKey,
        usdiMint: usdiMint.publicKey,
        rent: RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      },
      signers: [mockUSDCVault],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const currentTokenData = await connection.getAccountInfo(
      tokenDataAccount.publicKey
    );
    console.log(currentTokenData);
  });

  it("pool initialized!", async () => {
    await inceptProgram.rpc.initializePool(
      managerAccount[1],
      new BN(150),
      new BN(200),
      {
        accounts: {
          admin: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          usdiMint: usdiMint.publicKey,
          usdiTokenAccount: usdiPoolTokenAccount.publicKey,
          iassetMint: iassetMint.publicKey,
          iassetTokenAccount: iAssetPoolTokenAccount.publicKey,
          liquidationIassetTokenAccount:
            iAssetLiquidationTokenAccount.publicKey,
          liquidityTokenMint: liquidityTokenMintAccount.publicKey,
          cometLiquidityTokenAccount: cometLiquidityTokenAccount.publicKey,
          oracle: priceFeed.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
        signers: [
          usdiPoolTokenAccount,
          iassetMint,
          iAssetPoolTokenAccount,
          liquidityTokenMintAccount,
          iAssetLiquidationTokenAccount,
          cometLiquidityTokenAccount,
        ],
      }
    );
  });

  it("price updated!", async () => {
    await inceptProgram.rpc.updatePrices(managerAccount[1], {
      remainingAccounts: [
        { isSigner: false, isWritable: false, pubkey: priceFeed.publicKey },
      ],
      accounts: {
        manager: managerAccount[0],
        tokenData: tokenDataAccount.publicKey,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const tokenData = await inceptProgram.account.tokenData.fetch(
      tokenDataAccount.publicKey
    );
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
    await mockUSDCProgram.rpc.mintMockUsdc(mockUSDCAccount[1], {
      accounts: {
        mockUsdcMint: mockUSDCMint.publicKey,
        mockUsdcTokenAccount: mockUSDCTokenAccountInfo.address,
        mockUsdcAccount: mockUSDCAccount[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [],
    });
    await mockUSDCProgram.rpc.mintMockUsdc(mockUSDCAccount[1], {
      accounts: {
        mockUsdcMint: mockUSDCMint.publicKey,
        mockUsdcTokenAccount: mockUSDCTokenAccountInfo.address,
        mockUsdcAccount: mockUSDCAccount[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [],
    });
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
      new BN(2500000000000000),
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
          { isSigner: false, isWritable: false, pubkey: priceFeed.publicKey },
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
      new BN(100000000000000),
      new BN(23000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
          mintPositions: mintPositionsAccount.publicKey,
          vault: mockUSDCVault.publicKey,
          userCollateralTokenAccount: mockUSDCTokenAccountInfo.address,
          iassetMint: iassetMint.publicKey,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          oracle: priceFeed.publicKey,
          rent: RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        },
      }
    );
    let tx = new anchor.web3.Transaction()
      .add(priceUpdateIx)
      .add(initializeMintPositionIx);
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
      new BN(10000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
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
          { isSigner: false, isWritable: false, pubkey: priceFeed.publicKey },
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
      new BN(8000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
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

  it("iasset burned!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.payBackMint(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(50000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          mintPositions: mintPositionsAccount.publicKey,
          iassetMint: iassetMint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    console.log(
      "User now has " +
        Number(iassetTokenAccountInfo.amount / 1000000000000) +
        " iAsset."
    );
  });

  it("iasset reminted!", async () => {
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    let priceUpdateIx = inceptProgram.instruction.updatePrices(
      managerAccount[1],
      {
        remainingAccounts: [
          { isSigner: false, isWritable: false, pubkey: priceFeed.publicKey },
        ],
        accounts: {
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
        },
      }
    );

    let addIassetToMintIx = inceptProgram.instruction.addIassetToMint(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(60000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          mintPositions: mintPositionsAccount.publicKey,
          iassetMint: iassetMint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );
    let tx = new anchor.web3.Transaction()
      .add(priceUpdateIx)
      .add(addIassetToMintIx);
    let signers = [provider.wallet.payer];
    tx.setSigners(...signers.map((s) => s.publicKey));
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    tx.feePayer = walletPubkey;
    tx.partialSign(...signers);
    let signedTransaction = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signedTransaction);

    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    console.log(
      "User now has " +
        Number(iassetTokenAccountInfo.amount / 1000000000000) +
        " iAsset."
    );
  });

  const liquidityToken = new Token(
    connection,
    liquidityTokenMintAccount.publicKey,
    TOKEN_PROGRAM_ID,
    // @ts-ignore
    provider.wallet.payer
  );

  it("liquidity provided!", async () => {
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.provideLiquidity(
      managerAccount[1],
      new BN(0),
      new BN(60000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
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

  it("liquidity withdrawn!", async () => {
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    liquidityTokenAccountInfo = await liquidityToken.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.withdrawLiquidity(
      managerAccount[1],
      new BN(0),
      new BN(100000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
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

  it("iasset bought!", async () => {
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.buySynth(
      managerAccount[1],
      new BN(0),
      new BN(5000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userUsdiTokenAccount: usdiTokenAccountInfo.address,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
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

  it("iasset sold!", async () => {
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.sellSynth(
      managerAccount[1],
      new BN(0),
      new BN(1000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userUsdiTokenAccount: usdiTokenAccountInfo.address,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
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

  it("comet initialized!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.initializeComet(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(200000000),
      new BN(40000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
          usdiMint: usdiMint.publicKey,
          iassetMint: iassetMint.publicKey,
          usdcMint: mockUSDCMint.publicKey,
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
      new BN(100000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
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

  it("comet collateral withdrawn!", async () => {
    mockUSDCTokenAccountInfo = await mockUSDC.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.withdrawCollateralFromComet(
      managerAccount[1],
      userAccount[1],
      new BN(0),
      new BN(110000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
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

  it("iasset bought!", async () => {
    usdiTokenAccountInfo = await usdi.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );
    iassetTokenAccountInfo = await iasset.getOrCreateAssociatedAccountInfo(
      walletPubkey
    );

    await inceptProgram.rpc.buySynth(
      managerAccount[1],
      new BN(0),
      new BN(20000000000000),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userUsdiTokenAccount: usdiTokenAccountInfo.address,
          userIassetTokenAccount: iassetTokenAccountInfo.address,
          ammUsdiTokenAccount: usdiPoolTokenAccount.publicKey,
          ammIassetTokenAccount: iAssetPoolTokenAccount.publicKey,
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
      new BN(0),
      {
        accounts: {
          user: walletPubkey,
          manager: managerAccount[0],
          tokenData: tokenDataAccount.publicKey,
          userAccount: userAccount[0],
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
