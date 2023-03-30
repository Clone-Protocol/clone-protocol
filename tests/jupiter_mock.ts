import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { JupiterAggMock } from "../sdk/src/idl/jupiter_agg_mock";
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Pyth } from "../sdk/src/idl/pyth";
import { createPriceFeed, setPrice } from "../sdk/src/oracle";
import {
  PublicKey,
  Connection,
  ConfirmOptions,
  TransactionInstruction,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import { toDevnetScale } from "../sdk/src/incept";
import { assert } from "chai";
import { Decimal } from "../sdk/src/decimal";

describe("jupiter mock aggregator", async () => {
  // const provider = anchor.Provider.local();
  // anchor.setProvider(provider);
  let jupiterProgram = anchor.workspace
    .JupiterAggMock as Program<JupiterAggMock>;
  let pythProgram = anchor.workspace.Pyth as Program<Pyth>;

  let [jupiterAddress, nonce] = await PublicKey.findProgramAddress(
    [Buffer.from("jupiter")],
    jupiterProgram.programId
  );
  let usdcMint = anchor.web3.Keypair.generate();
  //let jupiterAccountAddress = anchor.web3.Keypair.generate();
  let assetMint = anchor.web3.Keypair.generate();

  it("initialize", async () => {
    await jupiterProgram.rpc.initialize({
      accounts: {
        admin: jupiterProgram.provider.publicKey!,
        jupiterAccount: jupiterAddress,
        usdcMint: usdcMint.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      instructions: [],
      signers: [usdcMint],
    });

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );
  });

  it("create mock asset", async () => {
    let price = 10;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);
    let priceFeedKey = await createPriceFeed(pythProgram, price, expo, conf);

    await jupiterProgram.rpc.createAsset(priceFeedKey, {
      accounts: {
        payer: jupiterProgram.provider.publicKey!,
        assetMint: assetMint.publicKey,
        jupiterAccount: jupiterAddress,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [assetMint],
    });
  });

  it("mint usdc", async () => {
    let usdcMintAmount = 1000;

    let usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      jupiterProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        jupiterProgram.provider.publicKey!, // payer
        usdcAssociatedTokenAddress, // ata
        jupiterProgram.provider.publicKey!, // owner
        usdcMint.publicKey // mint
      )
    );

    await jupiterProgram.provider.sendAndConfirm!(tx);

    await jupiterProgram.rpc.mintUsdc(
      nonce,
      new BN(usdcMintAmount * 10000000),
      {
        accounts: {
          usdcMint: usdcMint.publicKey,
          usdcTokenAccount: usdcAssociatedTokenAddress,
          jupiterAccount: jupiterAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, usdcMintAmount);
  });

  it("mint asset", async () => {
    let assetMintAmount = 10;

    let assetAssociatedTokenAddress = await getAssociatedTokenAddress(
      assetMint.publicKey,
      jupiterProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        jupiterProgram.provider.publicKey!, // payer
        assetAssociatedTokenAddress, // ata
        jupiterProgram.provider.publicKey!, // owner
        assetMint.publicKey // mint
      )
    );

    await jupiterProgram.provider.sendAndConfirm!(tx);

    await jupiterProgram.rpc.mintAsset(
      nonce,
      0,
      new BN(assetMintAmount * 100000000),
      {
        accounts: {
          assetMint: assetMint.publicKey,
          assetTokenAccount: assetAssociatedTokenAddress,
          jupiterAccount: jupiterAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let assetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      assetAssociatedTokenAddress
    );
    assert.equal(Number(assetTokenAccount.amount) / 100000000, assetMintAmount);
  });

  it("swap asset", async () => {
    let amount = 10;

    let assetAssociatedTokenAddress = await getAssociatedTokenAddress(
      assetMint.publicKey,
      jupiterProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      jupiterProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );
    // Swap 10 asset out.
    await jupiterProgram.rpc.swap(
      nonce,
      0,
      false,
      true,
      new BN(amount * 100000000),
      {
        accounts: {
          user: jupiterProgram.provider.publicKey!,
          jupiterAccount: jupiterAddress,
          assetMint: assetMint.publicKey,
          usdcMint: usdcMint.publicKey,
          userAssetTokenAccount: assetAssociatedTokenAddress,
          userUsdcTokenAccount: usdcAssociatedTokenAddress,
          pythOracle: jupiterAccount.oracles[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let assetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      assetAssociatedTokenAddress
    );
    let usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );

    assert.equal(Number(assetTokenAccount.amount) / 100000000, 10 + 10);
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, 1000 - 100);

    // Swap 10 asset in.
    await jupiterProgram.rpc.swap(
      nonce,
      0,
      true,
      true,
      new BN(amount * 100000000),
      {
        accounts: {
          user: jupiterProgram.provider.publicKey!,
          jupiterAccount: jupiterAddress,
          assetMint: assetMint.publicKey,
          usdcMint: usdcMint.publicKey,
          userAssetTokenAccount: assetAssociatedTokenAddress,
          userUsdcTokenAccount: usdcAssociatedTokenAddress,
          pythOracle: jupiterAccount.oracles[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    assetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      assetAssociatedTokenAddress
    );
    usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );

    assert.equal(Number(assetTokenAccount.amount) / 100000000, 10);
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, 1000);
  });

  it("swap usdc", async () => {
    let amount = 100;

    let assetAssociatedTokenAddress = await getAssociatedTokenAddress(
      assetMint.publicKey,
      jupiterProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      jupiterProgram.provider.publicKey!,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    // Swap 100 usdc out
    await jupiterProgram.rpc.swap(
      nonce,
      0,
      false,
      false,
      new BN(amount * 10000000),
      {
        accounts: {
          user: jupiterProgram.provider.publicKey!,
          jupiterAccount: jupiterAddress,
          assetMint: assetMint.publicKey,
          usdcMint: usdcMint.publicKey,
          userAssetTokenAccount: assetAssociatedTokenAddress,
          userUsdcTokenAccount: usdcAssociatedTokenAddress,
          pythOracle: jupiterAccount.oracles[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let assetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      assetAssociatedTokenAddress
    );
    let usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );

    assert.equal(Number(assetTokenAccount.amount) / 100000000, 10 - 10);
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, 1000 + 100);

    // Swap 100 usdc in
    await jupiterProgram.rpc.swap(
      nonce,
      0,
      true,
      false,
      new BN(amount * 10000000),
      {
        accounts: {
          user: jupiterProgram.provider.publicKey!,
          jupiterAccount: jupiterAddress,
          assetMint: assetMint.publicKey,
          usdcMint: usdcMint.publicKey,
          userAssetTokenAccount: assetAssociatedTokenAddress,
          userUsdcTokenAccount: usdcAssociatedTokenAddress,
          pythOracle: jupiterAccount.oracles[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    assetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      assetAssociatedTokenAddress
    );
    usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );

    assert.equal(Number(assetTokenAccount.amount) / 100000000, 10);
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, 1000);
  });
});
