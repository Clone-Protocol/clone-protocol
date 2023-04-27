// Implements the comet manager strategy

import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
  AddressLookupTableProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { toDevnetScale } from "../../sdk/src/incept";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { toNumber } from "../../sdk/src/decimal";
import {
  calculateExecutionThreshold,
  calculateExecutionThresholdFromParams,
  calculateInputFromOutputFromParams,
} from "../../sdk/src/utils";
import {
  Incept as InceptProgram,
  IDL as InceptIDL,
} from "../../sdk/src/idl/incept";
import {
  InceptCometManager,
  IDL as InceptCometManagerIDL,
} from "../../sdk/src/idl/incept_comet_manager";
import {
  IDL as JupiterAggMockIDL,
  JupiterAggMock,
} from "../../sdk/src/idl/jupiter_agg_mock";
import {
  createMintUsdcInstruction,
  MintUsdcInstructionAccounts,
  MintUsdcInstructionArgs,
} from "../../sdk/generated/jupiter-agg-mock/index";
import {
  ManagerInfo,
  AddCollateralToCometInstructionAccounts,
  createAddCollateralToCometInstruction,
  AddCollateralToCometInstructionArgs,
  createAddLiquidityInstruction,
  InitializeSubscriptionInstructionAccounts,
  createInitializeSubscriptionInstruction,
  createInitializeInstruction,
  createSubscribeInstruction,
  SubscribeInstructionAccounts,
  SubscribeInstructionArgs,
  AddLiquidityInstructionAccounts,
  AddLiquidityInstructionArgs,
} from "../../sdk/generated/incept-comet-manager";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock/index";
import {
  Incept,
  TokenData,
  Comet,
  createUpdatePricesInstruction,
  UpdatePricesInstructionAccounts,
  UpdatePricesInstructionArgs,
  createMintUsdiInstruction,
  MintUsdiInstructionAccounts,
  MintUsdiInstructionArgs,
  User,
} from "../../sdk/generated/incept/index";
import {
  setupAddressLookupTable,
  getManagerTokenAccountAddresses,
  getTreasuryTokenAccountAddresses,
} from "./address_lookup";

const main = async () => {
  let config = {
    inceptProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    inceptCometManagerProgramID: new PublicKey(
      process.env.COMET_MANAGER_PROGRAM_ID!
    ),
    jupiterProgramID: new PublicKey(process.env.JUPITER_PROGRAM_ID!),
    usdiToMint: 1_000_000,
    usdiLiquidity: 2_000_000,
  };

  const provider = anchor.AnchorProvider.env();

  const airdropSignature = await provider.connection.requestAirdrop(
    provider.publicKey,
    LAMPORTS_PER_SOL
  );

  await provider.connection.confirmTransaction(airdropSignature);

  const inceptProgram = new anchor.Program<InceptProgram>(
    InceptIDL,
    config.inceptProgramID,
    provider
  );
  const jupiterProgram = new anchor.Program<JupiterAggMock>(
    JupiterAggMockIDL,
    config.jupiterProgramID,
    provider
  );

  let cometAccount = anchor.web3.Keypair.generate();

  const [managerInfoAddress, _managerInfoBump] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("manager-info"), provider.publicKey!.toBuffer()],
      config.inceptCometManagerProgramID
    );

  const [inceptAccountAddress, _inceptNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("incept")],
    config.inceptProgramID
  );

  const [userAccountAddress, userAccountBump] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), managerInfoAddress.toBuffer()],
      config.inceptProgramID
    );

  const [jupiterAccountAddress, jupiterBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("jupiter")],
    config.jupiterProgramID
  );

  const incept = await Incept.fromAccountAddress(
    provider.connection,
    inceptAccountAddress
  );
  const jupiter = await Jupiter.fromAccountAddress(
    provider.connection,
    jupiterAccountAddress
  );
  const tokenData = await TokenData.fromAccountAddress(
    provider.connection,
    incept.tokenData
  );

  let createIx = await inceptProgram.account.comet.createInstruction(
    cometAccount
  );

  let createManagerIx = createInitializeInstruction(
    {
      admin: provider.publicKey!,
      managerInfo: managerInfoAddress,
      userAccount: userAccountAddress,
      comet: cometAccount.publicKey,
      incept: inceptAccountAddress,
      inceptProgram: config.inceptProgramID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    },
    {
      userBump: userAccountBump,
      withdrawalFeeBps: 2000,
      managementFeeBps: 16,
    }
  );
  await provider.sendAndConfirm!(
    new Transaction().add(createIx).add(createManagerIx),
    [cometAccount]
  );

  const usdcTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider,
    jupiter.usdcMint,
    provider.publicKey!
  );
  const usdiTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider,
    incept.usdiMint,
    provider.publicKey!
  );
  // const managerUsdcTokenAccount = await getOrCreateAssociatedTokenAccount(
  //     provider,
  //     jupiter.usdcMint,
  //     managerInfoAddress,
  //     true
  // )
  const managerUsdiTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider,
    incept.usdiMint,
    managerInfoAddress,
    true
  );

  // Mint USDC from jupiter,
  let mintUsdcIx = createMintUsdcInstruction(
    {
      usdcMint: jupiter.usdcMint,
      usdcTokenAccount: usdcTokenAccount.address,
      jupiterAccount: jupiterAccountAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as MintUsdcInstructionAccounts,
    {
      nonce: jupiterBump,
      amount: new anchor.BN(config.usdiToMint * 10_000_000),
    } as MintUsdcInstructionArgs
  );
  // Mint USDI for subscription.
  let mintUsdiIx = createMintUsdiInstruction(
    {
      user: provider.publicKey!,
      incept: inceptAccountAddress,
      usdiMint: incept.usdiMint,
      userUsdiTokenAccount: usdiTokenAccount.address,
      usdcMint: jupiter.usdcMint,
      userCollateralTokenAccount: usdcTokenAccount.address,
      inceptProgram: config.inceptProgramID,
      tokenData: incept.tokenData,
      usdcVault: tokenData.collaterals[1].vault,
    } as MintUsdiInstructionAccounts,
    {
      amount: toDevnetScale(config.usdiToMint),
    } as MintUsdiInstructionArgs
  );

  await provider.sendAndConfirm(
    new Transaction().add(mintUsdcIx).add(mintUsdiIx)
  );

  // Initial subscription
  let [subscribeAccountAddress, _bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("subscriber"),
      provider.publicKey!.toBuffer(),
      managerInfoAddress.toBuffer(),
    ],
    config.inceptCometManagerProgramID
  );
  // Create subscription account
  let createInitializeSubscription = createInitializeSubscriptionInstruction(
    {
      subscriptionOwner: provider.publicKey!,
      subscriber: subscribeAccountAddress,
      managerInfo: managerInfoAddress,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as InitializeSubscriptionInstructionAccounts,
    config.inceptCometManagerProgramID
  );
  // Supply USDi
  let createSubscribe = createSubscribeInstruction(
    {
      subscriber: provider.publicKey!,
      subscriberAccount: subscribeAccountAddress,
      managerInfo: managerInfoAddress,
      incept: inceptAccountAddress,
      managerInceptUser: userAccountAddress,
      usdiMint: incept.usdiMint,
      subscriberUsdiTokenAccount: usdiTokenAccount.address,
      managerUsdiTokenAccount: managerUsdiTokenAccount.address,
      inceptProgram: config.inceptProgramID,
      tokenData: incept.tokenData,
      inceptUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as SubscribeInstructionAccounts,
    {
      usdiCollateralToProvide: toDevnetScale(config.usdiToMint),
    } as SubscribeInstructionArgs
  );

  await provider.sendAndConfirm(
    new Transaction().add(createInitializeSubscription).add(createSubscribe)
  );

  const managerInfo = await ManagerInfo.fromAccountAddress(
    provider.connection,
    managerInfoAddress
  );
  const user = await User.fromAccountAddress(
    provider.connection,
    userAccountAddress
  );

  // Add collateral to comet.
  let addCollateralToComet = createAddCollateralToCometInstruction(
    {
      managerOwner: managerInfo.owner,
      managerInfo: managerInfoAddress,
      incept: managerInfo.incept,
      managerInceptUser: managerInfo.userAccount,
      usdiMint: incept.usdiMint,
      managerUsdiTokenAccount: managerUsdiTokenAccount.address,
      inceptProgram: config.inceptProgramID,
      comet: user.comet,
      tokenData: incept.tokenData,
      inceptUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as AddCollateralToCometInstructionAccounts,
    {
      amount: toDevnetScale(config.usdiToMint),
    } as AddCollateralToCometInstructionArgs
  );

  const poolIndex = 0;
  const pool = tokenData.pools[poolIndex];
  // Add liquidity to comet
  let addLiquidityToComet = createAddLiquidityInstruction(
    {
      managerOwner: managerInfo.owner,
      managerInfo: managerInfoAddress,
      incept: managerInfo.incept,
      managerInceptUser: managerInfo.userAccount,
      usdiMint: incept.usdiMint,
      inceptProgram: config.inceptProgramID,
      comet: user.comet,
      tokenData: incept.tokenData,
      iassetMint: pool.assetInfo.iassetMint,
      ammUsdiTokenAccount: pool.usdiTokenAccount,
      ammIassetTokenAccount: pool.iassetTokenAccount,
      liquidityTokenMint: pool.liquidityTokenMint,
      cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as AddLiquidityInstructionAccounts,
    {
      poolIndex,
      usdiAmount: toDevnetScale(config.usdiLiquidity),
    } as AddLiquidityInstructionArgs
  );

  // Update prices instruction
  let indices: number[] = [];
  let priceFeeds: Array<{
    pubkey: PublicKey;
    isWritable: boolean;
    isSigner: boolean;
  }> = [];

  tokenData.pools.slice(0, tokenData.numPools.toNumber()).forEach((_, i) => {
    indices.push(i);
    priceFeeds.push({
      pubkey: tokenData.pools[i].assetInfo.pythAddress,
      isWritable: false,
      isSigner: false,
    });
  });

  let zero_padding = 128 - indices.length;
  for (let i = 0; i < zero_padding; i++) {
    indices.push(0);
  }
  let updatePrices = createUpdatePricesInstruction(
    {
      incept: inceptAccountAddress,
      tokenData: incept.tokenData,
      anchorRemainingAccounts: priceFeeds,
    } as UpdatePricesInstructionAccounts,
    { poolIndices: { indices } } as UpdatePricesInstructionArgs
  );
  await provider.sendAndConfirm(
    new Transaction()
      .add(updatePrices)
      .add(addCollateralToComet)
      .add(addLiquidityToComet)
  );

  // Verify that we have a comet with collateral
  const managersComet = await Comet.fromAccountAddress(
    provider.connection,
    cometAccount.publicKey
  );
  console.log(
    `MANAGER COMET POSITION: 
        Positions: ${managersComet.numPositions.toNumber()}
        USDi ${toNumber(managersComet.positions[0].borrowedUsdi)}`
  );
  console.log(
    `MANAGER COMET COLLATERAL: 
        Positions: ${managersComet.numCollaterals.toNumber()}
        USDi ${toNumber(managersComet.collaterals[0].collateralAmount)}`
  );

  const managerAddresses = await getManagerTokenAccountAddresses(
    provider,
    managerInfoAddress,
    tokenData,
    incept.usdiMint,
    jupiter.usdcMint,
    jupiter.assetMints.slice(0, jupiter.nAssets)
  );
  const treasuryAddresses = await getTreasuryTokenAccountAddresses(
    provider,
    incept.treasuryAddress,
    tokenData,
    incept.usdiMint,
    jupiter.usdcMint
  );

  const _account = await setupAddressLookupTable(
    provider,
    incept,
    inceptAccountAddress,
    managerInfo,
    managerAddresses,
    managerInfoAddress,
    user,
    tokenData,
    treasuryAddresses,
    jupiter,
    jupiterAccountAddress,
    config.jupiterProgramID
  );

  console.log("INITIALIZATION FINISHED");
};

main().then();
