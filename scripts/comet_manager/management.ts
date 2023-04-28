import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  Account,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { DEVNET_TOKEN_SCALE, toDevnetScale } from "../../sdk/src/incept";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { toNumber } from "../../sdk/src/decimal";
import {
  sleep,
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
  ManagerInfo,
  createWithdrawCollateralFromCometInstruction,
  createAddCollateralToCometInstruction,
  WithdrawLiquidityInstructionAccounts,
  createWithdrawLiquidityInstruction,
  WithdrawLiquidityInstructionArgs,
  AddLiquidityInstructionAccounts,
  createAddLiquidityInstruction,
  AddLiquidityInstructionArgs,
  Subscriber,
  createUpdateNetValueInstruction,
  createFulfillRedemptionRequestInstruction,
} from "../../sdk/generated/incept-comet-manager";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock/index";
import {
  Incept,
  TokenData,
  Comet,
  User,
} from "../../sdk/generated/incept/index";
import {
  getHealthScore,
  getEffectiveUSDCollateralValue,
} from "../../sdk/src/healthscore";
import {
  TokenAccountAddresses,
  getManagerTokenAccountAddresses,
  getTreasuryTokenAccountAddresses,
} from "./address_lookup";
import { updatePricesInstructionCreate } from "./utils";

const checkUsdiAndUpdateUsdiBalance = async (
  provider: anchor.Provider,
  usdiAccountAddress: PublicKey,
  managerInfo: ManagerInfo,
  managerInfoAddress: PublicKey,
  incept: Incept,
  inceptAccountAddress: PublicKey,
  tokenData: TokenData,
  managerInceptUser: User
) => {
  const usdiAccount = await getAccount(provider.connection, usdiAccountAddress);

  if (Number(usdiAccount.amount) > 0) {
    let tx = new Transaction();
    tx.add(
      createAddCollateralToCometInstruction(
        {
          managerOwner: managerInfo.owner,
          managerInfo: managerInfoAddress,
          incept: inceptAccountAddress,
          managerInceptUser: managerInfo.userAccount,
          usdiMint: incept.usdiMint,
          comet: managerInceptUser.comet,
          tokenData: incept.tokenData,
          inceptUsdiVault: tokenData.collaterals[0].vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          inceptProgram: managerInfo.inceptProgram,
          managerUsdiTokenAccount: usdiAccountAddress,
        },
        { amount: usdiAccount.amount }
      )
    );
    await provider.sendAndConfirm!(tx);
  }
};

const rebalanceStrategy = async (
  comet: Comet,
  tokenData: TokenData,
  targetHealthScore: number,
  ildHealthImpact: number,
  collateralValue: number
) => {
  const nPositions = comet.numPositions.toNumber();
  const targetPositionHealthImpact = targetHealthScore - ildHealthImpact;
  const perPositionImpact =
    (targetPositionHealthImpact * collateralValue) / nPositions;

  return comet.positions.slice(0, nPositions).map((pos) => {
    const pool = tokenData.pools[pos.poolIndex.toNumber()];
    return (
      perPositionImpact /
      toNumber(pool.assetInfo.positionHealthScoreCoefficient)
    );
  });
};

const rebalancePositions = async (
  provider: anchor.AnchorProvider,
  managerInfo: ManagerInfo,
  managerInfoAddress: PublicKey,
  managerAddresses: TokenAccountAddresses,
  managerInceptUser: User,
  incept: Incept,
  inceptAccountAddress: PublicKey,
  tokenData: TokenData,
  comet: Comet,
  targetHealthScore: number,
  positionThreshold: number,
  addressLookupTableAccount: AddressLookupTableAccount
): Promise<void> => {
  // Calculate current position health score, (score without ILD)
  const nPositions = Number(comet.numPositions);
  const { healthScore, ildHealthImpact } = getHealthScore(tokenData, comet);
  const totalCollateralAmount = getEffectiveUSDCollateralValue(
    tokenData,
    comet
  );
  const positionHealthScore =
    targetHealthScore - ildHealthImpact / totalCollateralAmount;
  const perPositionHealthScore = (100 - positionHealthScore) / nPositions;

  const instructions: TransactionInstruction[] = [];

  comet.positions.slice(0, nPositions).forEach((position, index) => {
    const pool = tokenData.pools[position.poolIndex];
    const usdiPositionSize = toNumber(position.borrowedUsdi);
    const coefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
    const targetPositionSize = perPositionHealthScore / coefficient;
    const absPositionDiff = Math.abs(usdiPositionSize - targetPositionSize);

    if (absPositionDiff / targetPositionSize <= positionThreshold) {
      return;
    }

    if (usdiPositionSize > perPositionHealthScore) {
      // Add liquidity
      const addLiquidityToComet: AddLiquidityInstructionAccounts = {
        managerOwner: managerInfo.owner,
        managerInfo: managerInfoAddress,
        incept: inceptAccountAddress,
        managerInceptUser: managerInfo.incept,
        usdiMint: incept.usdiMint,
        inceptProgram: managerInfo.inceptProgram,
        comet: managerInceptUser.comet,
        tokenData: incept.tokenData,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
      instructions.push(
        createAddLiquidityInstruction(addLiquidityToComet, {
          poolIndex: position.poolIndex,
          usdiAmount: toDevnetScale(absPositionDiff),
        } as AddLiquidityInstructionArgs)
      );
    } else {
      // Add prices updates.
      instructions.push(
        updatePricesInstructionCreate(
          inceptAccountAddress,
          incept.tokenData,
          tokenData
        )
      );
      // Withdraw liquidity
      const lpToWithdraw =
        (absPositionDiff * toNumber(pool.liquidityTokenSupply)) /
        toNumber(pool.usdiAmount);
      const withdrawLiquidity: WithdrawLiquidityInstructionAccounts = {
        signer: managerInfo.owner,
        managerInfo: managerInfoAddress,
        incept: inceptAccountAddress,
        managerInceptUser: managerInfo.incept,
        usdiMint: incept.usdiMint,
        inceptProgram: managerInfo.inceptProgram,
        comet: managerInceptUser.comet,
        tokenData: incept.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        managerIassetTokenAccount:
          managerAddresses.iassetToken[position.poolIndex],
        managerUsdiTokenAccount: managerAddresses.usdiToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
      instructions.push(
        createWithdrawLiquidityInstruction(withdrawLiquidity, {
          cometPositionIndex: index,
          liquidityTokenAmount: toDevnetScale(lpToWithdraw),
        } as WithdrawLiquidityInstructionArgs)
      );
    }
  });

  // Create versioned transaction and send
  const { blockhash } = await provider.connection.getLatestBlockhash(
    "finalized"
  );
  const messageV0 = new anchor.web3.TransactionMessage({
    payerKey: managerInfo.owner,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([addressLookupTableAccount]);
  // create a v0 transaction from the v0 message
  const transactionV0 = new anchor.web3.VersionedTransaction(messageV0);

  await provider.sendAndConfirm!(transactionV0);
};

const getNetValue = async (
  provider: anchor.Provider,
  cometManagerInfoAddress: PublicKey,
  managerInceptUser: User,
  tokenData: TokenData,
  inceptAccountAddress: PublicKey,
  incept: Incept,
  managerUsdiTokenAccount: PublicKey,
  managerUsdcTokenAccount: PublicKey
) => {
  let iassetAccountsCalls: Promise<Account>[] = [];
  let underlyingAccountsCalls: Promise<Account>[] = [];
  type Item = { pubkey: PublicKey; isSigner: boolean; isWritable: boolean };
  let remainingAccounts: Item[] = [];
  const createItem = (pubkey: PublicKey) => {
    return { pubkey, isSigner: false, isWritable: false };
  };
  let managerInfo = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerInfoAddress
  );

  for (
    let poolIndex = 0;
    poolIndex < tokenData.numPools.toNumber();
    poolIndex++
  ) {
    let pool = tokenData.pools[poolIndex];
    iassetAccountsCalls.push(
      getOrCreateAssociatedTokenAccount(
        provider,
        pool.assetInfo.iassetMint,
        cometManagerInfoAddress,
        true
      )
    );

    underlyingAccountsCalls.push(
      (async () => {
        let underlying = await getAccount(
          provider.connection,
          pool.underlyingAssetTokenAccount
        );
        let underlyingAta = await getOrCreateAssociatedTokenAccount(
          provider,
          underlying.mint,
          cometManagerInfoAddress,
          true
        );

        return underlyingAta;
      })()
    );
  }

  Promise.all(iassetAccountsCalls).then((accounts) => {
    accounts.forEach((account) =>
      remainingAccounts.push(createItem(account.address))
    );
  });

  Promise.all(underlyingAccountsCalls).then((accounts) => {
    accounts.forEach((account) =>
      remainingAccounts.push(createItem(account.address))
    );
    accounts.forEach((_, i) =>
      remainingAccounts.push(
        createItem(tokenData.pools[i].underlyingAssetTokenAccount)
      )
    );
    accounts.forEach((account) =>
      remainingAccounts.push(createItem(account.mint))
    );
  });

  let tx = new Transaction()
    .add(
      updatePricesInstructionCreate(
        inceptAccountAddress,
        incept.tokenData,
        tokenData
      )
    )
    .add(
      createUpdateNetValueInstruction({
        signer: provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        incept: inceptAccountAddress,
        managerInceptUser: managerInfo.userAccount,
        usdiMint: incept.usdiMint,
        usdcMint: tokenData.collaterals[1].mint,
        comet: managerInceptUser.comet,
        tokenData: incept.tokenData,
        managerUsdiTokenAccount,
        managerUsdcTokenAccount,
        anchorRemainingAccounts: remainingAccounts,
      })
    );

  // Run transaction,
  await provider.sendAndConfirm!(tx);
  // Read and return data.
  managerInfo = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerInfoAddress
  );

  return Number(managerInfo.netValueUsdi) * Math.pow(10, DEVNET_TOKEN_SCALE);
};

const handleRedemptions = async (
  provider: anchor.Provider,
  managerInfo: ManagerInfo,
  jupiterProgramId: PublicKey,
  managerInfoAddress: PublicKey,
  comet: Comet,
  managerInceptUser: User,
  tokenData: TokenData,
  inceptAccountAddress: PublicKey,
  incept: Incept,
  inceptProgramId: PublicKey,
  managerAddresses: TokenAccountAddresses,
  targetHealthScore: number,
  addressLookupTableAccount: AddressLookupTableAccount
): Promise<boolean> => {
  const instructions: TransactionInstruction[] = [];

  // Calculate what liquidity to withdraw/rebalance to
  // Create ixs for withdraw liquidity, withdraw collateral, redemptions.
  const MAX_REDEMPTIONS_PER_RUN = 8;

  let [subscriberAddresses, redemptionIndices] = (() => {
    let addresses: PublicKey[] = [];
    let indices: number[] = [];
    for (const [i, address] of managerInfo.userRedemptions.entries()) {
      if (!address.equals(PublicKey.default)) {
        const [subscriberAddress, bump] = PublicKey.findProgramAddressSync(
          [Buffer.from("subscriber"), address.toBuffer()],
          jupiterProgramId
        );
        indices.push(i);
        addresses.push(subscriberAddress);
        if (indices.length === MAX_REDEMPTIONS_PER_RUN) break;
      }
    }
    return [addresses, indices];
  })();

  if (subscriberAddresses.length === 0) return false;

  let subscriberAccounts = await Promise.all(
    subscriberAddresses.map((address) =>
      Subscriber.fromAccountAddress(provider.connection, address)
    )
  );

  // Calculate total amount of collateral needed to redeem.
  const netUsdiValue = await getNetValue(
    provider,
    managerInfoAddress,
    managerInceptUser,
    tokenData,
    inceptAccountAddress,
    incept,
    managerAddresses.usdiToken,
    managerAddresses.usdcToken
  );

  // Calculate how much USDi needs to be withdrawn...
  const totalTokenSupply =
    Number(managerInfo.membershipTokenSupply) *
    Math.pow(10, -DEVNET_TOKEN_SCALE);
  const totalTokensToRedeem = (() => {
    let result = 0;
    subscriberAccounts.forEach((account, index) => {
      result +=
        Number(account.membershipTokens) * Math.pow(10, -DEVNET_TOKEN_SCALE);
    });
    return result;
  })();
  const usdiToRedeem = (totalTokensToRedeem / totalTokenSupply) * netUsdiValue;

  const { healthScore, ildHealthImpact } = getHealthScore(tokenData, comet);
  const usdiPositionTargets = await rebalanceStrategy(
    comet,
    tokenData,
    targetHealthScore,
    ildHealthImpact,
    toNumber(comet.collaterals[0].collateralAmount) - usdiToRedeem
  );

  comet.positions
    .slice(0, comet.numPositions.toNumber())
    .forEach((pos, index) => {
      const currentUsdiPosition = toNumber(pos.borrowedUsdi);
      const targetUsdiPosition = usdiPositionTargets[index];
      if (currentUsdiPosition < targetUsdiPosition) return;

      const pool = tokenData.pools[pos.poolIndex.toNumber()];
      const poolUsdi = toNumber(pool.usdiAmount);
      const lpSupply = toNumber(pool.liquidityTokenSupply);
      const lpToWithdraw =
        (lpSupply * (targetUsdiPosition - currentUsdiPosition)) / poolUsdi;

      const withdrawLiquidity: WithdrawLiquidityInstructionAccounts = {
        signer: managerInfo.owner,
        managerInfo: managerInfoAddress,
        incept: inceptAccountAddress,
        managerInceptUser: managerInfo.incept,
        usdiMint: incept.usdiMint,
        inceptProgram: managerInfo.inceptProgram,
        comet: managerInceptUser.comet,
        tokenData: incept.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.usdiTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        managerIassetTokenAccount: managerAddresses.iassetToken[pos.poolIndex],
        managerUsdiTokenAccount: managerAddresses.usdiToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
      instructions.push(
        createWithdrawLiquidityInstruction(withdrawLiquidity, {
          cometPositionIndex: index,
          liquidityTokenAmount: toDevnetScale(lpToWithdraw),
        } as WithdrawLiquidityInstructionArgs)
      );
    });

  // Withdraw Collateral
  instructions.push(
    createWithdrawCollateralFromCometInstruction(
      {
        signer: managerInfo.owner,
        managerInfo: managerInfoAddress,
        incept: inceptAccountAddress,
        managerInceptUser: managerInfo.userAccount,
        usdiMint: incept.usdiMint,
        managerUsdiTokenAccount: managerAddresses.usdiToken,
        inceptProgram: managerInfo.inceptProgram,
        comet: managerInceptUser.comet,
        tokenData: incept.tokenData,
        inceptUsdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount: toDevnetScale(usdiToRedeem),
      }
    )
  );

  let subscriberUsdAddresses = await Promise.all(
    subscriberAccounts.map((subscriber) =>
      getOrCreateAssociatedTokenAccount(
        provider,
        incept.usdiMint,
        subscriber.owner
      )
    )
  );

  // Redeem
  let createAccountsRedemptionIx = (
    index: number,
    subscriberAccountAddress: PublicKey,
    subscriberUsdiAddress: PublicKey
  ) => {
    return {
      managerOwner: provider.publicKey!,
      managerInfo: managerInfoAddress,
      incept: inceptAccountAddress,
      managerInceptUser: managerInfo.userAccount,
      subscriberAccount: subscriberAccountAddress,
      usdiMint: incept.usdiMint,
      subscriberUsdiTokenAccount: subscriberUsdiAddress,
      managerUsdiTokenAccount: managerAddresses.usdiToken,
      inceptProgram: inceptProgramId,
      tokenData: incept.tokenData,
      inceptUsdiVault: tokenData.collaterals[0].vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    };
  };

  redemptionIndices.forEach((index) =>
    instructions.push(
      createFulfillRedemptionRequestInstruction(
        createAccountsRedemptionIx(
          index,
          subscriberAddresses[index],
          subscriberUsdAddresses[index].address
        ),
        { index }
      )
    )
  );

  // Create versioned transaction and send
  const { blockhash } = await provider.connection.getLatestBlockhash(
    "finalized"
  );
  const messageV0 = new anchor.web3.TransactionMessage({
    payerKey: managerInfo.owner,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([addressLookupTableAccount]);
  // create a v0 transaction from the v0 message
  const transactionV0 = new anchor.web3.VersionedTransaction(messageV0);

  await provider.sendAndConfirm!(transactionV0);
  return true;
};

const main = async () => {
  let config = {
    inceptProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    inceptCometManager: new PublicKey(process.env.COMET_MANAGER_PROGRAM_ID!),
    jupiterProgramId: new PublicKey(process.env.JUPITER_PROGRAM_ID!),
    lookupTableAddress: new PublicKey(process.env.LOOKUP_TABLE_ADDRESS!),
    intervalSeconds: 60,
    targetHealthScore: 70,
    positionThreshold: 0.05,
  };
  const provider = anchor.AnchorProvider.env();

  const [inceptAccountAddress, _inceptNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("incept")],
    config.inceptProgramID
  );

  const [cometManagerAccountAddress, _cometManagerNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("manager-info"), provider.publicKey!.toBuffer()],
      config.inceptCometManager
    );

  const [jupiterAccountAddress, jupiterNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("jupiter")],
      config.jupiterProgramId
    );

  const [userAccountAddress, _inceptUserNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), cometManagerAccountAddress.toBuffer()],
      config.inceptProgramID
    );

  const incept = await Incept.fromAccountAddress(
    provider.connection,
    inceptAccountAddress
  );

  let userAccount = await User.fromAccountAddress(
    provider.connection,
    userAccountAddress
  );

  const inceptProgram = new anchor.Program<InceptProgram>(
    InceptIDL,
    config.inceptProgramID,
    provider
  );

  const managerProgram = new anchor.Program<InceptCometManager>(
    InceptCometManagerIDL,
    config.inceptCometManager,
    provider
  );

  // Current manager state
  let managerState = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerAccountAddress
  );

  let tokenData = await TokenData.fromAccountAddress(
    provider.connection,
    incept.tokenData
  );
  let comet = await Comet.fromAccountAddress(
    provider.connection,
    userAccount.comet
  );

  let jupiter = await Jupiter.fromAccountAddress(
    provider.connection,
    jupiterAccountAddress
  );

  const managerAddresses = await getManagerTokenAccountAddresses(
    provider,
    cometManagerAccountAddress,
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

  const altAccount = (await provider.connection
    .getAddressLookupTable(config.lookupTableAddress)
    .then((res) => res.value))!;

  // Setup account listening
  // Subscribe to account changes
  managerProgram.account.managerInfo
    .subscribe(cometManagerAccountAddress, "recent")
    .on("change", (account: ManagerInfo) => {
      managerState = account;
    });
  inceptProgram.account.tokenData
    .subscribe(incept.tokenData, "recent")
    .on("change", (account: TokenData) => {
      tokenData = account;
    });
  inceptProgram.account.comet
    .subscribe(userAccount.comet, "recent")
    .on("change", (account: Comet) => {
      comet = account;
    });
  inceptProgram.account.user
    .subscribe(userAccountAddress, "recent")
    .on("change", (account: User) => {
      userAccount = account;
    });

  while (true) {
    await checkUsdiAndUpdateUsdiBalance(
      provider,
      managerAddresses.usdiToken,
      managerState,
      cometManagerAccountAddress,
      incept,
      inceptAccountAddress,
      tokenData,
      userAccount
    );

    // Try and redeem
    let executed = await handleRedemptions(
      provider,
      managerState,
      config.jupiterProgramId,
      cometManagerAccountAddress,
      comet,
      userAccount,
      tokenData,
      inceptAccountAddress,
      incept,
      config.inceptProgramID,
      managerAddresses,
      config.targetHealthScore,
      altAccount
    );
    // Else try and rebalance
    if (!executed) {
      await rebalancePositions(
        provider,
        managerState,
        cometManagerAccountAddress,
        managerAddresses,
        userAccount,
        incept,
        inceptAccountAddress,
        tokenData,
        comet,
        config.targetHealthScore,
        config.positionThreshold,
        altAccount
      );
    }

    await sleep(config.intervalSeconds * 1e3);
  }
};

main();
