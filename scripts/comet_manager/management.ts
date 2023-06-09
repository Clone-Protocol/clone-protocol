import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAccount, Account } from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  AddressLookupTableAccount,
  Connection,
} from "@solana/web3.js";
import { DEVNET_TOKEN_SCALE, toDevnetScale } from "../../sdk/src/clone";
import { getOrCreateAssociatedTokenAccount } from "../../tests/utils";
import { toNumber } from "../../sdk/src/decimal";
import { sleep } from "../../sdk/src/utils";
import {
  Clone as CloneProgram,
  IDL as CloneIDL,
} from "../../sdk/src/idl/clone";
import {
  CloneCometManager,
  IDL as CloneCometManagerIDL,
} from "../../sdk/src/idl/clone_comet_manager";
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
} from "../../sdk/generated/clone-comet-manager";
import { Jupiter } from "../../sdk/generated/jupiter-agg-mock/index";
import {
  Clone,
  TokenData,
  Comet,
  User,
} from "../../sdk/generated/clone/index";
import {
  getHealthScore,
  getEffectiveUSDCollateralValue,
} from "../../sdk/src/healthscore";
import {
  TokenAccountAddresses,
  getManagerTokenAccountAddresses,
  getTreasuryTokenAccountAddresses,
} from "./address_lookup";
import {
  buildUpdatePricesInstruction,
  getKeypairFromAWSSecretsManager,
  generateKeypairFromBuffer,
} from "./utils";

const checkUsdiAndUpdateUsdiBalance = async (
  provider: anchor.Provider,
  onusdAccountAddress: PublicKey,
  managerInfo: ManagerInfo,
  managerInfoAddress: PublicKey,
  clone: Clone,
  cloneAccountAddress: PublicKey,
  tokenData: TokenData,
  managerCloneUser: User
) => {
  const onusdAccount = await getAccount(provider.connection, onusdAccountAddress);
  console.log("USDI ADDRESS:", onusdAccountAddress.toString());
  if (Number(onusdAccount.amount) > 0) {
    console.log("Adding USDi balance to comet!", Number(onusdAccount.amount));
    let tx = new Transaction();
    tx.add(
      createAddCollateralToCometInstruction(
        {
          managerOwner: managerInfo.owner,
          managerInfo: managerInfoAddress,
          clone: cloneAccountAddress,
          managerCloneUser: managerInfo.userAccount,
          onusdMint: clone.onusdMint,
          comet: managerCloneUser.comet,
          tokenData: clone.tokenData,
          cloneUsdiVault: tokenData.collaterals[0].vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          cloneProgram: managerInfo.cloneProgram,
          managerUsdiTokenAccount: onusdAccountAddress,
        },
        { amount: new anchor.BN(onusdAccount.amount) }
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
  const nPositions = Number(comet.numPositions);
  const targetPositionHealthImpact = targetHealthScore - ildHealthImpact;
  const perPositionImpact =
    (targetPositionHealthImpact * collateralValue) / nPositions;

  return comet.positions.slice(0, nPositions).map((pos) => {
    const pool = tokenData.pools[Number(pos.poolIndex)];
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
  managerCloneUser: User,
  clone: Clone,
  cloneAccountAddress: PublicKey,
  tokenData: TokenData,
  comet: Comet,
  targetHealthScore: number,
  positionThreshold: number,
  addressLookupTableAccount: AddressLookupTableAccount
): Promise<boolean> => {
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
  console.log(
    "HEALTH SCORE:",
    healthScore,
    targetHealthScore,
    ildHealthImpact,
    perPositionHealthScore,
    totalCollateralAmount
  );
  let updatePricesIx = buildUpdatePricesInstruction(
    cloneAccountAddress,
    clone.tokenData,
    tokenData
  );
  const instructions: TransactionInstruction[] = [updatePricesIx];

  comet.positions.slice(0, nPositions).forEach((position, index) => {
    const pool = tokenData.pools[Number(position.poolIndex)];
    const onusdPositionSize = toNumber(position.borrowedUsdi);
    const coefficient = toNumber(pool.assetInfo.positionHealthScoreCoefficient);
    const targetPositionSize =
      (totalCollateralAmount * perPositionHealthScore) / coefficient;
    console.log("TARGET:", index, targetPositionSize, onusdPositionSize);
    const absPositionDiff = Math.abs(onusdPositionSize - targetPositionSize);

    if (absPositionDiff / targetPositionSize <= positionThreshold) {
      return;
    }

    if (targetPositionSize > onusdPositionSize) {
      // Add liquidity
      const addLiquidityToComet: AddLiquidityInstructionAccounts = {
        managerOwner: managerInfo.owner,
        managerInfo: managerInfoAddress,
        clone: managerInfo.clone,
        managerCloneUser: managerInfo.userAccount,
        onusdMint: clone.onusdMint,
        cloneProgram: managerInfo.cloneProgram,
        comet: managerCloneUser.comet,
        tokenData: clone.tokenData,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.onusdTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      };

      instructions.push(
        createAddLiquidityInstruction(addLiquidityToComet, {
          poolIndex: Number(position.poolIndex),
          onusdAmount: toDevnetScale(absPositionDiff),
        } as AddLiquidityInstructionArgs)
      );
    } else {
      // Withdraw liquidity
      const lpToWithdraw =
        (absPositionDiff * toNumber(pool.liquidityTokenSupply)) /
        toNumber(pool.onusdAmount);
      console.log();
      const withdrawLiquidity: WithdrawLiquidityInstructionAccounts = {
        signer: managerInfo.owner,
        managerInfo: managerInfoAddress,
        clone: managerInfo.clone,
        managerCloneUser: managerInfo.userAccount,
        onusdMint: clone.onusdMint,
        cloneProgram: managerInfo.cloneProgram,
        comet: managerCloneUser.comet,
        tokenData: clone.tokenData,
        cloneUsdiVault: tokenData.collaterals[0].vault,
        iassetMint: pool.assetInfo.iassetMint,
        ammUsdiTokenAccount: pool.onusdTokenAccount,
        ammIassetTokenAccount: pool.iassetTokenAccount,
        liquidityTokenMint: pool.liquidityTokenMint,
        cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
        managerIassetTokenAccount:
          managerAddresses.iassetToken[Number(position.poolIndex)],
        managerUsdiTokenAccount: managerAddresses.onusdToken,
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

  if (instructions.length === 1) {
    return false;
  }
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

const getNetValue = async (
  provider: anchor.Provider,
  cometManagerInfoAddress: PublicKey,
  managerCloneUser: User,
  tokenData: TokenData,
  cloneAccountAddress: PublicKey,
  clone: Clone,
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

  for (let poolIndex = 0; poolIndex < Number(tokenData.numPools); poolIndex++) {
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
      buildUpdatePricesInstruction(
        cloneAccountAddress,
        clone.tokenData,
        tokenData
      )
    )
    .add(
      createUpdateNetValueInstruction({
        signer: provider.publicKey!,
        managerInfo: cometManagerInfoAddress,
        clone: managerInfo.clone,
        managerCloneUser: managerInfo.userAccount,
        onusdMint: clone.onusdMint,
        usdcMint: tokenData.collaterals[1].mint,
        comet: managerCloneUser.comet,
        tokenData: clone.tokenData,
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
  managerCloneUser: User,
  tokenData: TokenData,
  cloneAccountAddress: PublicKey,
  clone: Clone,
  cloneProgramId: PublicKey,
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
    managerCloneUser,
    tokenData,
    cloneAccountAddress,
    clone,
    managerAddresses.onusdToken,
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
  const onusdToRedeem = (totalTokensToRedeem / totalTokenSupply) * netUsdiValue;

  const { healthScore, ildHealthImpact } = getHealthScore(tokenData, comet);
  const onusdPositionTargets = await rebalanceStrategy(
    comet,
    tokenData,
    targetHealthScore,
    ildHealthImpact,
    toNumber(comet.collaterals[0].collateralAmount) - onusdToRedeem
  );

  comet.positions.slice(0, Number(comet.numPositions)).forEach((pos, index) => {
    const currentUsdiPosition = toNumber(pos.borrowedUsdi);
    const targetUsdiPosition = onusdPositionTargets[index];
    if (currentUsdiPosition < targetUsdiPosition) return;

    const pool = tokenData.pools[Number(pos.poolIndex)];
    const poolUsdi = toNumber(pool.onusdAmount);
    const lpSupply = toNumber(pool.liquidityTokenSupply);
    const lpToWithdraw =
      (lpSupply * (targetUsdiPosition - currentUsdiPosition)) / poolUsdi;

    const withdrawLiquidity: WithdrawLiquidityInstructionAccounts = {
      signer: managerInfo.owner,
      managerInfo: managerInfoAddress,
      clone: managerInfo.clone,
      managerCloneUser: managerInfo.userAccount,
      onusdMint: clone.onusdMint,
      cloneProgram: managerInfo.cloneProgram,
      comet: managerCloneUser.comet,
      tokenData: clone.tokenData,
      cloneUsdiVault: tokenData.collaterals[0].vault,
      iassetMint: pool.assetInfo.iassetMint,
      ammUsdiTokenAccount: pool.onusdTokenAccount,
      ammIassetTokenAccount: pool.iassetTokenAccount,
      liquidityTokenMint: pool.liquidityTokenMint,
      cometLiquidityTokenAccount: pool.cometLiquidityTokenAccount,
      managerIassetTokenAccount:
        managerAddresses.iassetToken[Number(pos.poolIndex)],
      managerUsdiTokenAccount: managerAddresses.onusdToken,
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
        clone: managerInfo.clone,
        managerCloneUser: managerInfo.userAccount,
        onusdMint: clone.onusdMint,
        managerUsdiTokenAccount: managerAddresses.onusdToken,
        cloneProgram: managerInfo.cloneProgram,
        comet: managerCloneUser.comet,
        tokenData: clone.tokenData,
        cloneUsdiVault: tokenData.collaterals[0].vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      {
        amount: toDevnetScale(onusdToRedeem),
      }
    )
  );

  let subscriberUsdAddresses = await Promise.all(
    subscriberAccounts.map((subscriber) =>
      getOrCreateAssociatedTokenAccount(
        provider,
        clone.onusdMint,
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
      clone: cloneAccountAddress,
      managerCloneUser: managerInfo.userAccount,
      subscriberAccount: subscriberAccountAddress,
      onusdMint: clone.onusdMint,
      subscriberUsdiTokenAccount: subscriberUsdiAddress,
      managerUsdiTokenAccount: managerAddresses.onusdToken,
      cloneProgram: cloneProgramId,
      tokenData: clone.tokenData,
      cloneUsdiVault: tokenData.collaterals[0].vault,
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
  console.log(
    "---COMET MANAGER POOL LIQUIDITY MANAGEMENT ALGORITHM RUNNING---"
  );
  let config = {
    cloneProgramID: new PublicKey(process.env.INCEPT_PROGRAM_ID!),
    cloneCometManager: new PublicKey(process.env.COMET_MANAGER_PROGRAM_ID!),
    jupiterProgramId: new PublicKey(process.env.JUPITER_PROGRAM_ID!),
    lookupTableAddress: new PublicKey(process.env.LOOKUP_TABLE_ADDRESS!),
    intervalSeconds: Number(process.env.INTERVAL ?? "60"),
    targetHealthScore: Number(process.env.TARGET_HEALTH_SCORE ?? "90"),
    positionThreshold: Number(process.env.POSITION_THRESHOLD ?? "0.05"),
    awsSecretName: process.env.AWS_SECRET_NAME,
  };
  const provider = await (async () => {
    if (config.awsSecretName) {
      const secretBuffer = await getKeypairFromAWSSecretsManager(
        config.awsSecretName!
      );
      const keypair = generateKeypairFromBuffer(JSON.parse(secretBuffer));
      const wallet = new anchor.Wallet(keypair);
      const options = anchor.AnchorProvider.defaultOptions();
      const connection = new Connection(
        process.env.ANCHOR_PROVIDER_URL!,
        options.commitment
      );
      return new anchor.AnchorProvider(connection, wallet, options);
    } else {
      return anchor.AnchorProvider.env();
    }
  })();

  const [cloneAccountAddress, _cloneNonce] = PublicKey.findProgramAddressSync(
    [Buffer.from("clone")],
    config.cloneProgramID
  );

  const [cometManagerAccountAddress, _cometManagerNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("manager-info"), provider.publicKey!.toBuffer()],
      config.cloneCometManager
    );

  const [jupiterAccountAddress, jupiterNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("jupiter")],
      config.jupiterProgramId
    );

  const [userAccountAddress, _cloneUserNonce] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), cometManagerAccountAddress.toBuffer()],
      config.cloneProgramID
    );
  console.log("USER ACCOUNT ADDRESS:", userAccountAddress.toString());

  const clone = await Clone.fromAccountAddress(
    provider.connection,
    cloneAccountAddress
  );

  let userAccount = await User.fromAccountAddress(
    provider.connection,
    userAccountAddress
  );

  const cloneProgram = new anchor.Program<CloneProgram>(
    CloneIDL,
    config.cloneProgramID,
    provider
  );

  const managerProgram = new anchor.Program<CloneCometManager>(
    CloneCometManagerIDL,
    config.cloneCometManager,
    provider
  );

  // Current manager state
  let managerState = await ManagerInfo.fromAccountAddress(
    provider.connection,
    cometManagerAccountAddress
  );

  let tokenData = await TokenData.fromAccountAddress(
    provider.connection,
    clone.tokenData
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
    clone.onusdMint,
    jupiter.usdcMint,
    jupiter.assetMints.slice(0, jupiter.nAssets)
  );

  // const treasuryAddresses = await getTreasuryTokenAccountAddresses(
  //   provider,
  //   clone.treasuryAddress,
  //   tokenData,
  //   clone.onusdMint,
  //   jupiter.usdcMint
  // );

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
  cloneProgram.account.tokenData
    .subscribe(clone.tokenData, "recent")
    .on("change", (account: TokenData) => {
      console.log("TOKEN DATA UPDATED!");
      tokenData = account;
    });
  cloneProgram.account.comet
    .subscribe(userAccount.comet, "recent")
    .on("change", (account: Comet) => {
      comet = account;
    });
  cloneProgram.account.user
    .subscribe(userAccountAddress, "recent")
    .on("change", (account: User) => {
      userAccount = account;
    });

  while (true) {
    await checkUsdiAndUpdateUsdiBalance(
      provider,
      managerAddresses.onusdToken,
      managerState,
      cometManagerAccountAddress,
      clone,
      cloneAccountAddress,
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
      cloneAccountAddress,
      clone,
      config.cloneProgramID,
      managerAddresses,
      config.targetHealthScore,
      altAccount
    );
    // Else try and rebalance
    if (!executed) {
      let rebalanced = await rebalancePositions(
        provider,
        managerState,
        cometManagerAccountAddress,
        managerAddresses,
        userAccount,
        clone,
        cloneAccountAddress,
        tokenData,
        comet,
        config.targetHealthScore,
        config.positionThreshold,
        altAccount
      );
      if (rebalanced) {
        console.log("REBALANCED POSITIONS!");
      }
    }

    await sleep(config.intervalSeconds * 1e3);
  }
};

main();
