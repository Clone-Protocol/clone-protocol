import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Signer,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { fetchAccounts, mintTokenToDestination } from "./utils";
import {
  Clone as CloneAccount,
  Pools,
  Oracles,
  createInitializeUserInstruction,
  InitializeUserInstructionAccounts,
  InitializeUserInstructionArgs,
  User,
  createInitializeIsolatedMarginUserInstruction,
} from "../sdk/generated/clone";
import {
  AddIsolatedCometInstructionAccounts,
  AddIsolatedCometInstructionArgs,
  InitializePositionManagerInstructionAccounts,
  InitializePositionManagerInstructionArgs,
  createAddIsolatedCometInstruction,
  createInitializePositionManagerInstruction,
  PositionManager,
  createAddCollateralToIsolatedCometInstruction,
  AddCollateralToIsolatedCometInstructionAccounts,
  AddCollateralToIsolatedCometInstructionArgs,
  createWithdrawCollateralFromIsolatedCometInstruction,
  WithdrawCollateralFromIsolatedCometInstructionAccounts,
  WithdrawLiquidityFromIsolatedCometInstructionArgs,
  createAddLiquidityToIsolatedCometInstruction,
  AddLiquidityToIsolatedCometInstructionAccounts,
  AddLiquidityToIsolatedCometInstructionArgs,
  createWithdrawLiquidityFromIsolatedCometInstruction,
  WithdrawLiquidityFromIsolatedCometInstructionAccounts,
  createCollectLpRewardFromIsolatedCometInstruction,
  CollectLpRewardFromIsolatedCometInstructionAccounts,
  CollectLpRewardFromIsolatedCometInstructionArgs,
  createPayIsolatedCometImpermanentLossDebtInstruction,
  PayIsolatedCometImpermanentLossDebtInstructionAccounts,
  PayIsolatedCometImpermanentLossDebtInstructionArgs,
  PaymentType,
  createCloseTokenAccountInstruction,
  CloseTokenAccountInstructionAccounts,
  CloseTokenAccountInstructionArgs,
  createRemovePositionFromIsolatedCometInstruction,
  RemovePositionFromIsolatedCometInstructionAccounts,
  RemovePositionFromIsolatedCometInstructionArgs,
  createCloseIsolatedCometInstruction,
  CloseIsolatedCometInstructionAccounts,
  CloseIsolatedCometInstructionArgs,
} from "../sdk/generated/isolated_margin_comets";
import { assert } from "chai";
import { CloneClient, toCloneScale } from "../sdk/src/clone";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  AccountLayout,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { getILD } from "../sdk/src/healthscore";

const SOLANA_RPC_ENDPOINT =
  process.env.SOLANA_RPC_ENDPOINT ?? "https://api.mainnet-beta.solana.com";

describe("isolated margin", async function () {
  before(async function () {
    this.cloneProgramId = new PublicKey(
      "C1onEW2kPetmHmwe74YC1ESx3LnFEpVau6g2pg4fHycr"
    );
    this.isolatedMarginProgramId = new PublicKey(
      "HeXLPMQr13eLB6k6rvX2phBg3ETpvzqMBnZxSZy9tvn3"
    );
    this.usdcMint = new PublicKey(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    );
    this.cloneAccountAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("clone")],
      this.cloneProgramId
    )[0];
    this.poolAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("pools")],
      this.cloneProgramId
    )[0];
    this.oracleAddress = PublicKey.findProgramAddressSync(
      [Buffer.from("oracles")],
      this.cloneProgramId
    )[0];

    let accountsToFetch = [
      this.cloneAccountAddress,
      this.poolAddress,
      this.oracleAddress,
      this.usdcMint,
    ];
    const connection = new Connection(SOLANA_RPC_ENDPOINT, "confirmed");
    this.cloneAccount = await CloneAccount.fromAccountAddress(
      connection,
      this.cloneAccountAddress
    );
    accountsToFetch.push(
      ...[this.cloneAccount.collateral.vault, this.cloneAccount.treasuryAddress]
    );

    const pools = await Pools.fromAccountAddress(connection, this.poolAddress);
    const oracles = await Oracles.fromAccountAddress(
      connection,
      this.oracleAddress
    );
    pools.pools.forEach((pool) => {
      accountsToFetch.push(pool.assetInfo.onassetMint);
      accountsToFetch.push(pool.underlyingAssetTokenAccount);
    });

    oracles.oracles.forEach((oracle) => {
      accountsToFetch.push(oracle.address);
    });
    this.oracles = oracles;
    this.pools = pools;
    const accounts = await fetchAccounts(SOLANA_RPC_ENDPOINT, accountsToFetch);
    this.bankrunContext = await startAnchor(".", [], accounts);
    this.provider = new BankrunProvider(this.bankrunContext);
    this.cloneClient = new CloneClient(
      this.provider,
      this.cloneAccount,
      this.cloneProgramId
    );

    this.payer = this.bankrunContext.payer.publicKey;

    this.processTransaction = async function (
      ixn: TransactionInstruction[],
      signers?: Signer[],
      payer?: Keypair
    ) {
      const tx = new Transaction().add(...ixn);
      tx.recentBlockhash = this.bankrunContext.lastBlockhash;
      tx.sign(payer ?? this.bankrunContext.payer);
      if (signers && signers.length > 0) {
        tx.partialSign(...signers);
      }
      return await this.bankrunContext.banksClient.processTransaction(tx);
    };

    this.fetchAccountBuffer = async function (address: PublicKey) {
      return Buffer.from(
        (await this.bankrunContext.banksClient.getAccount(address)).data
      );
    };
  });

  it("initialize isolated margin account", async function () {
    this.managerAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("manager"), this.payer.toBuffer()],
      this.isolatedMarginProgramId
    )[0];

    let ix = createInitializePositionManagerInstruction(
      {
        payer: this.payer,
        managerAccount: this.managerAccount,
      } as InitializePositionManagerInstructionAccounts,
      {
        authority: this.payer,
      } as InitializePositionManagerInstructionArgs
    );

    await this.processTransaction([ix]);
  });

  it("initialize positions", async function () {
    let uniqueSeed = 12;
    this.ownerAccount = PublicKey.findProgramAddressSync(
      [Buffer.from([uniqueSeed]), this.managerAccount.toBuffer()],
      this.isolatedMarginProgramId
    )[0];
    this.userAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), this.ownerAccount.toBuffer()],
      this.cloneProgramId
    )[0];

    let ixns: TransactionInstruction[] = [
      createInitializeIsolatedMarginUserInstruction(
        {
          payer: this.payer,
          userAccount: this.userAccount,
        } as InitializeUserInstructionAccounts,
        {
          authority: this.ownerAccount,
        } as InitializeUserInstructionArgs
      ),
      createAddIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          cloneProgram: this.cloneProgramId,
          userAccount: this.userAccount,
        } as AddIsolatedCometInstructionAccounts,
        { uniqueSeed } as AddIsolatedCometInstructionArgs
      ),
    ];
    await this.processTransaction(ixns);

    let managerAccount = (
      await PositionManager.deserialize(
        await this.fetchAccountBuffer(this.managerAccount)
      )
    )[0];

    assert.equal(
      managerAccount.accountSeeds.length,
      1,
      "account seeds not added"
    );
    assert.equal(
      managerAccount.accountSeeds[0],
      uniqueSeed,
      "account seeds incorrect"
    );
  });

  it("deposit collateral", async function () {
    const startingUSDC = 1000000_000000n;

    this.payerUsdcAta = await mintTokenToDestination(
      this.bankrunContext,
      this.usdcMint,
      startingUSDC
    );

    const collateralAmount = 250000_000000;

    // Create USDC token account for owner.
    const usdcAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      this.ownerAccount,
      true
    );

    const ixns: TransactionInstruction[] = [
      createAssociatedTokenAccountInstruction(
        this.payer,
        usdcAta,
        this.ownerAccount,
        this.usdcMint
      ),
      createTransferInstruction(
        this.payerUsdcAta,
        usdcAta,
        this.payer,
        collateralAmount
      ),
      createAddCollateralToIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          ownerCollateralTokenAccount: usdcAta,
          vault: this.cloneAccount.collateral.vault,
        } as AddCollateralToIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
        } as AddCollateralToIsolatedCometInstructionArgs
      ),
    ];

    await this.processTransaction(ixns);

    const userAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    assert.equal(
      Number(userAccount.comet.collateralAmount),
      collateralAmount,
      "collateral amount incorrect"
    );

    const currentUSDCbalance = Number(
      AccountLayout.decode(await this.fetchAccountBuffer(this.payerUsdcAta))
        .amount
    );
    assert.equal(
      currentUSDCbalance,
      Number(startingUSDC) - collateralAmount,
      "collateral balance incorrect"
    );
  });

  it("withdraw collateral", async function () {
    const startingUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];
    const startingUSDCbalance = Number(
      AccountLayout.decode(await this.fetchAccountBuffer(this.payerUsdcAta))
        .amount
    );

    const withdrawalAmount = 50000_000000;

    // Create USDC token account for owner.
    const usdcAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      this.ownerAccount,
      true
    );

    const ixns: TransactionInstruction[] = [
      this.cloneClient.updatePricesInstruction(this.oracles),
      createWithdrawCollateralFromIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          ownerCollateralTokenAccount: usdcAta,
          vault: this.cloneAccount.collateral.vault,
          signerCollateralTokenAccount: this.payerUsdcAta,
          pools: this.poolAddress,
          oracles: this.oracleAddress,
        } as WithdrawCollateralFromIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
          amount: withdrawalAmount,
        } as WithdrawLiquidityFromIsolatedCometInstructionArgs
      ),
    ];

    await this.processTransaction(ixns);

    const currentUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];
    assert.equal(
      Number(startingUserAccount.comet.collateralAmount) - withdrawalAmount,
      Number(currentUserAccount.comet.collateralAmount),
      "user collateral amount incorrect"
    );

    const currentUSDCbalance = Number(
      AccountLayout.decode(await this.fetchAccountBuffer(this.payerUsdcAta))
        .amount
    );
    assert.equal(
      currentUSDCbalance,
      startingUSDCbalance + withdrawalAmount,
      "collateral balance incorrect"
    );
  });

  it("add liquidity", async function () {
    const liquidityToAdd = 80000_000000;

    const ixns: TransactionInstruction[] = [
      this.cloneClient.updatePricesInstruction(this.oracles),
      createAddLiquidityToIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          pools: this.poolAddress,
          oracles: this.oracleAddress,
        } as AddLiquidityToIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
          poolIndex: 0,
          amount: liquidityToAdd,
        } as AddLiquidityToIsolatedCometInstructionArgs
      ),
    ];

    await this.processTransaction(ixns);
    const currentUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    assert.equal(
      Number(
        currentUserAccount.comet.positions[0].committedCollateralLiquidity
      ),
      liquidityToAdd,
      "liquidity position size incorrect"
    );
  });
  it("withdraw liquidity", async function () {
    const startingUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    const liquidityToRemove = 3000_000000;

    const ixns: TransactionInstruction[] = [
      createWithdrawLiquidityFromIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          pools: this.poolAddress,
          oracles: this.oracleAddress,
        } as WithdrawLiquidityFromIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
          amount: liquidityToRemove,
        } as WithdrawLiquidityFromIsolatedCometInstructionArgs
      ),
    ];

    await this.processTransaction(ixns);

    const currentUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    assert.equal(
      Number(
        currentUserAccount.comet.positions[0].committedCollateralLiquidity
      ),
      Number(
        startingUserAccount.comet.positions[0].committedCollateralLiquidity
      ) - liquidityToRemove,
      "liquidity position size incorrect"
    );
  });

  it("collect LP rewards and pay ILD", async function () {
    const startingUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    const poolIndex = startingUserAccount.comet.positions[0].poolIndex;
    const pool = this.pools.pools[poolIndex];

    const clAssetTokenAccount = await mintTokenToDestination(
      this.bankrunContext,
      pool.assetInfo.onassetMint,
      0n
    );
    const clAssetTreasuryTokenAccount = await mintTokenToDestination(
      this.bankrunContext,
      pool.assetInfo.onassetMint,
      0n,
      this.cloneAccount.treasuryAddress
    );
    const usdcTreasuryTokenAccount = await mintTokenToDestination(
      this.bankrunContext,
      this.usdcMint,
      0n,
      this.cloneAccount.treasuryAddress
    );
    const usdcToSpend = 20000_000000;

    const ownerUsdcAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      this.ownerAccount,
      true
    );
    const ownerClassetAta = getAssociatedTokenAddressSync(
      pool.assetInfo.onassetMint,
      this.ownerAccount,
      true
    );

    await this.processTransaction([
      // Create a large swap transaction,
      this.cloneClient.updatePricesInstruction(this.oracles),
      this.cloneClient.swapInstruction(
        poolIndex,
        new BN(usdcToSpend),
        true,
        true,
        new BN(0),
        pool.assetInfo.onassetMint,
        this.payerUsdcAta,
        clAssetTokenAccount,
        usdcTreasuryTokenAccount,
        clAssetTreasuryTokenAccount
      ),
    ]);

    // Check that the user has ILD
    let currentUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];
    let pools = (
      await Pools.deserialize(await this.fetchAccountBuffer(this.poolAddress))
    )[0];

    let ild = getILD(
      this.cloneAccount.collateral,
      pools,
      this.oracles,
      currentUserAccount.comet
    )[0];

    assert.isAbove(ild.onAssetILD, 0, "swap didn't create classet ILD");
    assert.isBelow(
      ild.collateralILD,
      0,
      "swap didn't create collateral rewards"
    );

    await this.processTransaction([
      createWithdrawLiquidityFromIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          pools: this.poolAddress,
          oracles: this.oracleAddress,
        } as WithdrawLiquidityFromIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
          amount:
            currentUserAccount.comet.positions[0].committedCollateralLiquidity,
        } as WithdrawLiquidityFromIsolatedCometInstructionArgs
      ),
      createAssociatedTokenAccountInstruction(
        this.payer,
        ownerClassetAta,
        this.ownerAccount,
        pool.assetInfo.onassetMint
      ),
      // Collect LP rewards
      createCollectLpRewardFromIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          pools: this.poolAddress,
          onassetMint: pool.assetInfo.onassetMint,
          signerCollateralTokenAccount: this.payerUsdcAta,
          signerOnassetTokenAccount: clAssetTokenAccount,
          ownerCollateralTokenAccount: ownerUsdcAta,
          ownerOnassetTokenAccount: ownerClassetAta,
          vault: this.cloneAccount.collateral.vault,
        } as CollectLpRewardFromIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
        } as CollectLpRewardFromIsolatedCometInstructionArgs
      ),
      createPayIsolatedCometImpermanentLossDebtInstruction(
        {
          payer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          collateralMint: this.usdcMint,
          pools: this.poolAddress,
          onassetMint: pool.assetInfo.onassetMint,
          payerCollateralTokenAccount: this.payerUsdcAta,
          payerOnassetTokenAccount: clAssetTokenAccount,
          vault: this.cloneAccount.collateral.vault,
        } as PayIsolatedCometImpermanentLossDebtInstructionAccounts,
        {
          owner: this.payer,
          positionIndex: 0,
          amount: toCloneScale(ild.onAssetILD * 2),
          paymentType: PaymentType.Onasset,
        } as PayIsolatedCometImpermanentLossDebtInstructionArgs
      ),
    ]);

    // Check that the user's LP rewards have been updated
    currentUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];
    pools = (
      await Pools.deserialize(await this.fetchAccountBuffer(this.poolAddress))
    )[0];

    ild = getILD(
      this.cloneAccount.collateral,
      pools,
      this.oracles,
      currentUserAccount.comet
    )[0];

    assert.equal(ild.onAssetILD, 0, "ILD not paid");
    assert.equal(ild.collateralILD, 0, "collateral rewards not claimed");
  });

  it("withdraw all collateral from comet and close associated token accounts", async function () {
    // Close the associated token accounts
    const startingUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    const poolIndex = startingUserAccount.comet.positions[0].poolIndex;
    const pool = this.pools.pools[poolIndex];

    const ownerUsdcAta = getAssociatedTokenAddressSync(
      this.usdcMint,
      this.ownerAccount,
      true
    );
    const ownerClassetAta = getAssociatedTokenAddressSync(
      pool.assetInfo.onassetMint,
      this.ownerAccount,
      true
    );

    // Check that they exist
    assert.notEqual(
      await this.bankrunContext.banksClient.getAccount(ownerUsdcAta),
      null,
      "owner USDC ATA should exist"
    );
    assert.notEqual(
      await this.bankrunContext.banksClient.getAccount(ownerClassetAta),
      null,
      "owner clAsset ATA should exist"
    );

    await this.processTransaction([
      this.cloneClient.updatePricesInstruction(this.oracles),
      createWithdrawCollateralFromIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
          cloneAccount: this.cloneAccountAddress,
          ownerCollateralTokenAccount: ownerUsdcAta,
          vault: this.cloneAccount.collateral.vault,
          signerCollateralTokenAccount: this.payerUsdcAta,
          pools: this.poolAddress,
          oracles: this.oracleAddress,
        } as WithdrawCollateralFromIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
          amount: startingUserAccount.comet.collateralAmount,
        } as WithdrawLiquidityFromIsolatedCometInstructionArgs
      ),
      createCloseTokenAccountInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          tokenAccount: ownerUsdcAta,
        } as CloseTokenAccountInstructionAccounts,
        {
          positionIndex: 0,
        } as CloseTokenAccountInstructionArgs
      ),
      createCloseTokenAccountInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          tokenAccount: ownerClassetAta,
        } as CloseTokenAccountInstructionAccounts,
        {
          positionIndex: 0,
        } as CloseTokenAccountInstructionArgs
      ),
    ]);

    assert.equal(
      await this.bankrunContext.banksClient.getAccount(ownerUsdcAta),
      null,
      "owner USDC ATA should not exist"
    );
    assert.equal(
      await this.bankrunContext.banksClient.getAccount(ownerClassetAta),
      null,
      "owner clAsset ATA should not exist"
    );
  });

  it("close position and isolated margin comet", async function () {
    await this.processTransaction([
      createRemovePositionFromIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          pools: this.poolAddress,
          cloneProgram: this.cloneProgramId,
        } as RemovePositionFromIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
        } as RemovePositionFromIsolatedCometInstructionArgs
      ),
    ]);

    const currentUserAccount = (
      await User.deserialize(await this.fetchAccountBuffer(this.userAccount))
    )[0];

    assert.equal(
      currentUserAccount.comet.positions.length,
      0,
      "position not removed"
    );

    await this.processTransaction([
      createCloseIsolatedCometInstruction(
        {
          signer: this.payer,
          managerAccount: this.managerAccount,
          ownerAccount: this.ownerAccount,
          userAccount: this.userAccount,
          cloneProgram: this.cloneProgramId,
        } as CloseIsolatedCometInstructionAccounts,
        {
          positionIndex: 0,
        } as CloseIsolatedCometInstructionArgs
      ),
    ]);

    assert.equal(
      await this.bankrunContext.banksClient.getAccount(this.userAccount),
      null,
      "user account should not exist"
    );

    const positionManagerAccount = PositionManager.deserialize(
      await this.fetchAccountBuffer(this.managerAccount)
    )[0];
    assert.equal(
      positionManagerAccount.accountSeeds.length,
      0,
      "account seeds not removed"
    );
  });

  it("test max position size for position manager", async function () {
    // Move slot forward
    const slot = await this.bankrunContext.banksClient.getSlot();
    this.bankrunContext.warpToSlot(slot + 1n);

    const startingSolBalance = await this.bankrunContext.banksClient.getBalance(
      this.payer
    );

    // This is the limit as defined by the space allocated for the PositionManager account
    const N = 20;

    for (let seed = 0; seed < N; seed++) {
      const ownerAccount = PublicKey.findProgramAddressSync(
        [Buffer.from([seed]), this.managerAccount.toBuffer()],
        this.isolatedMarginProgramId
      )[0];
      const userAccount = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), ownerAccount.toBuffer()],
        this.cloneProgramId
      )[0];

      let ixns: TransactionInstruction[] = [
        createInitializeIsolatedMarginUserInstruction(
          {
            payer: this.payer,
            userAccount,
          } as InitializeUserInstructionAccounts,
          {
            authority: ownerAccount,
          } as InitializeUserInstructionArgs
        ),
        createAddIsolatedCometInstruction(
          {
            signer: this.payer,
            managerAccount: this.managerAccount,
            ownerAccount: ownerAccount,
            cloneProgram: this.cloneProgramId,
            userAccount,
          } as AddIsolatedCometInstructionAccounts,
          { uniqueSeed: seed } as AddIsolatedCometInstructionArgs
        ),
      ];
      await this.processTransaction(ixns);
    }

    const finalSolBalance = await this.bankrunContext.banksClient.getBalance(
      this.payer
    );

    const positionManagerAccount = PositionManager.deserialize(
      await this.fetchAccountBuffer(this.managerAccount)
    )[0];
    assert.equal(
      positionManagerAccount.accountSeeds.length,
      N,
      "account seeds not created"
    );

    // console.log(
    //   Number(startingSolBalance - finalSolBalance) / LAMPORTS_PER_SOL,
    //   `SOL spent for creating ${N} positions`
    // );
  });
});
