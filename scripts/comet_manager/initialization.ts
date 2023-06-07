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
import { toDevnetScale } from "../../sdk/src/clone";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { toNumber } from "../../sdk/src/decimal";
import { createVersionedTx } from "../../sdk/src/utils";
import {
  Clone as CloneProgram,
  IDL as CloneIDL,
} from "../../sdk/src/idl/clone";
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
} from "../../sdk/generated/clone-comet-manager";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock/index";
import {
  Clone,
  TokenData,
  Comet,
  createUpdatePricesInstruction,
  UpdatePricesInstructionAccounts,
  UpdatePricesInstructionArgs,
  createMintUsdiInstruction,
  MintUsdiInstructionAccounts,
  MintUsdiInstructionArgs,
  User,
} from "../../sdk/generated/clone/index";
import {
  setupAddressLookupTable,
  getManagerTokenAccountAddresses,
  getTreasuryTokenAccountAddresses,
} from "./address_lookup";
import {
  buildUpdateNetValueInstruction,
  buildUpdatePricesInstruction,
} from "./utils";

const main = async () => {
  let config = {
    cloneProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    cloneCometManagerProgramID: new PublicKey(
      process.env.COMET_MANAGER_PROGRAM_ID!
    ),
    jupiterProgramID: new PublicKey(process.env.JUPITER_PROGRAM_ID!),
    onusdToMint: 4_000_000,
    liquidityToAdd: [
      { liquidity: 1_000_000, poolIndex: 0 },
      { liquidity: 1_000_000, poolIndex: 1 },
      { liquidity: 1_000_000, poolIndex: 2 },
      { liquidity: 1_000_000, poolIndex: 3 },
      { liquidity: 1_000_000, poolIndex: 4 },
      { liquidity: 1_000_000, poolIndex: 5 },
      { liquidity: 1_000_000, poolIndex: 6 },
      { liquidity: 1_000_000, poolIndex: 7 },
      { liquidity: 1_000_000, poolIndex: 8 },
      { liquidity: 1_000_000, poolIndex: 9 },
    ],
  };

  const provider = anchor.AnchorProvider.env();

  // const airdropSignature = await provider.connection.requestAirdrop(
  //   provider.publicKey,
  //   LAMPORTS_PER_SOL
  // );

  // await provider.connection.confirmTransaction(airdropSignature);

  const cloneProgram = new anchor.Program<CloneProgram>(
    CloneIDL,
    config.cloneProgramID,
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
      config.cloneCometManagerProgramID
    );

  const [cloneAccountAddress, _cloneNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone")],
    config.cloneProgramID
  );

  const [userAccountAddress, userAccountBump] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), managerInfoAddress.toBuffer()],
      config.cloneProgramID
    );

  const [jupiterAccountAddress, jupiterBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("jupiter")],
    config.jupiterProgramID
  );

  const clone = await Clone.fromAccountAddress(
    provider.connection,
    cloneAccountAddress
  );
  const jupiter = await Jupiter.fromAccountAddress(
    provider.connection,
    jupiterAccountAddress
  );
  const tokenData = await TokenData.fromAccountAddress(
    provider.connection,
    clone.tokenData
  );

  let createIx = await cloneProgram.account.comet.createInstruction(
    cometAccount
  );

  let createManagerIx = createInitializeInstruction(
    {
      admin: provider.publicKey!,
      managerInfo: managerInfoAddress,
      userAccount: userAccountAddress,
      comet: cometAccount.publicKey,
      clone: cloneAccountAddress,
      cloneProgram: config.cloneProgramID,
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
  console.log("CREATED COMET MANAGER!");

  const usdcTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider,
    jupiter.usdcMint,
    provider.publicKey!
  );
  const onusdTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider,
    clone.onusdMint,
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
    clone.onusdMint,
    managerInfoAddress,
    true
  );

  const treasuryAddresses = await getTreasuryTokenAccountAddresses(
    provider,
    clone.treasuryAddress,
    tokenData,
    clone.onusdMint,
    jupiter.usdcMint
  );

  const managerAddresses = await getManagerTokenAccountAddresses(
    provider,
    managerInfoAddress,
    tokenData,
    clone.onusdMint,
    jupiter.usdcMint,
    jupiter.assetMints.slice(0, jupiter.nAssets)
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
      amount: new anchor.BN(config.onusdToMint * Math.pow(10, 7)),
    } as MintUsdcInstructionArgs
  );
  // Mint USDI for subscription.
  let mintUsdiIx = createMintUsdiInstruction(
    {
      user: provider.publicKey!,
      clone: cloneAccountAddress,
      onusdMint: clone.onusdMint,
      userUsdiTokenAccount: onusdTokenAccount.address,
      usdcMint: jupiter.usdcMint,
      userCollateralTokenAccount: usdcTokenAccount.address,
      cloneProgram: config.cloneProgramID,
      tokenData: clone.tokenData,
      usdcVault: tokenData.collaterals[1].vault,
    } as MintUsdiInstructionAccounts,
    {
      amount: toDevnetScale(config.onusdToMint),
    } as MintUsdiInstructionArgs
  );

  await provider.sendAndConfirm(
    new Transaction().add(mintUsdcIx).add(mintUsdiIx),
    [],
    { commitment: "recent" }
  );
  console.log(`MINTED USDC and WRAPPED USDi: ${config.onusdToMint}`);

  // Initial subscription
  let updatePricesIx = buildUpdatePricesInstruction(
    cloneAccountAddress,
    clone.tokenData,
    tokenData
  );

  let [subscribeAccountAddress, _bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("subscriber"),
      provider.publicKey!.toBuffer(),
      managerInfoAddress.toBuffer(),
    ],
    config.cloneCometManagerProgramID
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
    config.cloneCometManagerProgramID
  );
  // Supply USDi
  let createSubscribe = createSubscribeInstruction(
    {
      subscriber: provider.publicKey!,
      subscriberAccount: subscribeAccountAddress,
      managerInfo: managerInfoAddress,
      clone: cloneAccountAddress,
      managerCloneUser: userAccountAddress,
      onusdMint: clone.onusdMint,
      subscriberUsdiTokenAccount: onusdTokenAccount.address,
      managerUsdiTokenAccount: managerUsdiTokenAccount.address,
      cloneProgram: config.cloneProgramID,
      tokenData: clone.tokenData,
      cloneUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as SubscribeInstructionAccounts,
    {
      onusdCollateralToProvide: toDevnetScale(config.onusdToMint),
    } as SubscribeInstructionArgs
  );
  console.log("CREATING SUBSCRIPTION...");
  await provider.sendAndConfirm(
    new Transaction().add(createInitializeSubscription)
  );
  console.log("CREATED SUBSCRIPTION!");

  // let updateNetValueIx = await buildUpdateNetValueInstruction(
  //   provider,
  //   tokenData,
  //   managerInfoAddress,
  //   cloneAccountAddress,
  //   clone,
  //   managerAddresses.onusdToken,
  //   managerAddresses.usdcToken,
  //   managerAddresses.iassetToken,
  //   managerAddresses.underlyingToken!,
  //   jupiter.assetMints.slice(0, Number(jupiter.nAssets)),
  // );

  console.log("CONTRIBUTING CAPITAL!");
  await provider.sendAndConfirm(
    new Transaction().add(updatePricesIx).add(createSubscribe)
  );

  const managerInfo = await ManagerInfo.fromAccountAddress(
    provider.connection,
    managerInfoAddress
  );
  const user = await User.fromAccountAddress(
    provider.connection,
    userAccountAddress
  );

  console.log("ALT:", process.env.LOOKUP_TABLE_ADDRESS);

  const altAccount = await (async () => {
    if (process.env.LOOKUP_TABLE_ADDRESS) {
      const account = (await provider.connection
        .getAddressLookupTable(new PublicKey(process.env.LOOKUP_TABLE_ADDRESS!))
        .then((res) => res.value))!;
      return account;
    } else {
      const [account, _altAddress] = await setupAddressLookupTable(
        provider,
        clone,
        cloneAccountAddress,
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
      return account;
    }
  })();

  let tx = new Transaction();
  tx.add(updatePricesIx);

  console.log("MANAGER USDI", managerUsdiTokenAccount.amount);

  // Add collateral to comet.
  let addCollateralToComet = createAddCollateralToCometInstruction(
    {
      managerOwner: managerInfo.owner,
      managerInfo: managerInfoAddress,
      clone: managerInfo.clone,
      managerCloneUser: managerInfo.userAccount,
      onusdMint: clone.onusdMint,
      managerUsdiTokenAccount: managerUsdiTokenAccount.address,
      cloneProgram: config.cloneProgramID,
      comet: user.comet,
      tokenData: clone.tokenData,
      cloneUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as AddCollateralToCometInstructionAccounts,
    {
      amount: toDevnetScale(config.onusdToMint),
    } as AddCollateralToCometInstructionArgs
  );

  tx.add(addCollateralToComet);

  // Add liquidity to comet
  for (let { liquidity, poolIndex } of config.liquidityToAdd) {
    const pool = tokenData.pools[poolIndex];
    let addLiquidityToComet = createAddLiquidityInstruction(
      {
        managerOwner: managerInfo.owner,
        managerInfo: managerInfoAddress,
        clone: managerInfo.clone,
        managerCloneUser: managerInfo.userAccount,
        onusdMint: clone.onusdMint,
        cloneProgram: config.cloneProgramID,
        comet: user.comet,
        tokenData: clone.tokenData,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.onusdTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as AddLiquidityInstructionAccounts,
      {
        poolIndex,
        onusdAmount: toDevnetScale(liquidity),
      } as AddLiquidityInstructionArgs
    );
    tx.add(addLiquidityToComet);
  }

  // Should use a versioned transaction for this.
  const { blockhash } = await provider.connection.getLatestBlockhash(
    "finalized"
  );
  let versionedTx = createVersionedTx(provider.publicKey!, blockhash, tx, [
    altAccount,
  ]);
  console.log("SENDING VERSIONED TX");
  await provider.sendAndConfirm(versionedTx);

  // Verify that we have a comet with collateral
  const managersComet = await Comet.fromAccountAddress(
    provider.connection,
    user.comet
  );
  console.log(
    `MANAGER COMET POSITION: 
        Positions: ${Number(managersComet.numPositions)}
        USDi ${toNumber(managersComet.positions[0].borrowedUsdi)}`
  );
  console.log(
    `MANAGER COMET COLLATERAL: 
        Positions: ${Number(managersComet.numCollaterals)}
        USDi ${toNumber(managersComet.collaterals[0].collateralAmount)}`
  );

  console.log("INITIALIZATION FINISHED");
};

main().then();
