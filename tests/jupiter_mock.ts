import * as anchor from "@project-serum/anchor";
import { Program, BN } from "@project-serum/anchor";
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
  let iAssetMint = anchor.web3.Keypair.generate();

  it("initialize", async () => {
    await jupiterProgram.rpc.initialize(nonce, {
      accounts: {
        admin: jupiterProgram.provider.wallet.publicKey,
        jupiterAccount: jupiterAddress,
        usdcMint: usdcMint.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      instructions: [],
      signers: [usdcMint],
    });

    await jupiterProgram.rpc.stressTest(nonce, 10, {
        accounts: {
            jupiterAccount: jupiterAddress
        }
    });

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
        jupiterAddress
      );

    let answer = new Decimal(jupiterAccount.answer.data);

  });

  it("create iasset", async () => {
    let price = 10;
    const expo = -7;
    const conf = new BN((price / 10) * 10 ** -expo);
    let priceFeedKey = await createPriceFeed(pythProgram, price, expo, conf);

    await jupiterProgram.rpc.createIasset(priceFeedKey, {
      accounts: {
        payer: jupiterProgram.provider.wallet.publicKey,
        iassetMint: iAssetMint.publicKey,
        jupiterAccount: jupiterAddress,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [iAssetMint],
    });
  });

  it("mint usdc", async () => {
    let usdcMintAmount = 1000;

    let usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      jupiterProgram.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        jupiterProgram.provider.wallet.publicKey, // payer
        usdcAssociatedTokenAddress, // ata
        jupiterProgram.provider.wallet.publicKey, // owner
        usdcMint.publicKey // mint
      )
    );

    await jupiterProgram.provider.send(tx);

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

  it("mint iAsset", async () => {
    let iAssetMintAmount = 10;

    let iAssetAssociatedTokenAddress = await getAssociatedTokenAddress(
      iAssetMint.publicKey,
      jupiterProgram.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        jupiterProgram.provider.wallet.publicKey, // payer
        iAssetAssociatedTokenAddress, // ata
        jupiterProgram.provider.wallet.publicKey, // owner
        iAssetMint.publicKey // mint
      )
    );

    await jupiterProgram.provider.send(tx);

    await jupiterProgram.rpc.mintIasset(
      nonce,
      0,
      new BN(iAssetMintAmount * 100000000),
      {
        accounts: {
          iassetMint: iAssetMint.publicKey,
          iassetTokenAccount: iAssetAssociatedTokenAddress,
          jupiterAccount: jupiterAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let iAssetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      iAssetAssociatedTokenAddress
    );
    assert.equal(
      Number(iAssetTokenAccount.amount) / 100000000,
      iAssetMintAmount
    );
  });

  it("swap buy iAsset", async () => {
    let buyAmount = 10;

    let iAssetAssociatedTokenAddress = await getAssociatedTokenAddress(
      iAssetMint.publicKey,
      jupiterProgram.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      jupiterProgram.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await jupiterProgram.rpc.swap(
      nonce,
      0,
      true,
      new BN(buyAmount * 100000000),
      {
        accounts: {
          user: jupiterProgram.provider.wallet.publicKey,
          jupiterAccount: jupiterAddress,
          iassetMint: iAssetMint.publicKey,
          usdcMint: usdcMint.publicKey,
          userIassetTokenAccount: iAssetAssociatedTokenAddress,
          userUsdcTokenAccount: usdcAssociatedTokenAddress,
          pythOracle: jupiterAccount.oracles[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let iAssetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      iAssetAssociatedTokenAddress
    );
    let usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );

    assert.equal(Number(iAssetTokenAccount.amount) / 100000000, 10 + 10);
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, 1000 - 100);
  });

  it("swap sell iAsset", async () => {
    let sellAmount = 10;

    let iAssetAssociatedTokenAddress = await getAssociatedTokenAddress(
      iAssetMint.publicKey,
      jupiterProgram.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let usdcAssociatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      jupiterProgram.provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let jupiterAccount = await jupiterProgram.account.jupiter.fetch(
      jupiterAddress
    );

    await jupiterProgram.rpc.swap(
      nonce,
      0,
      false,
      new BN(sellAmount * 100000000),
      {
        accounts: {
          user: jupiterProgram.provider.wallet.publicKey,
          jupiterAccount: jupiterAddress,
          iassetMint: iAssetMint.publicKey,
          usdcMint: usdcMint.publicKey,
          userIassetTokenAccount: iAssetAssociatedTokenAddress,
          userUsdcTokenAccount: usdcAssociatedTokenAddress,
          pythOracle: jupiterAccount.oracles[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    );

    let iAssetTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      iAssetAssociatedTokenAddress
    );
    let usdcTokenAccount = await getAccount(
      jupiterProgram.provider.connection,
      usdcAssociatedTokenAddress
    );

    assert.equal(Number(iAssetTokenAccount.amount) / 100000000, 10);
    assert.equal(Number(usdcTokenAccount.amount) / 10000000, 1000);
  });
});
