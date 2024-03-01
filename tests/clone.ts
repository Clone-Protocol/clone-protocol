import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  Account,
} from "@solana/spl-token";
import { PublicKey, Transaction, SystemProgram, Keypair, Signer } from "@solana/web3.js";
import { assert } from "chai";
import {
  CLONE_TOKEN_SCALE,
  CloneClient,
  fromCloneScale,
  fromScale,
  toCloneScale,
  toScale,
  createInitializeCloneTransaction
} from "../sdk/src/clone";
import { createPriceFeed, setPrice } from "../sdk/src/oracle";
import {
  calculateSwapExecution,
  sleep,
  getOrCreateAssociatedTokenAccount,
} from "../sdk/src/utils";
import { getHealthScore, getILD } from "../sdk/src/healthscore";
import {
  Clone as CloneAccount,
  PoolParameters,
  OracleSource,
  PaymentType,
  Status,
  createCreateTokenMetadataInstruction,
  CreateTokenMetadataInstructionAccounts,
  CreateTokenMetadataInstructionArgs,
  createRemovePoolInstruction,
  RemovePoolInstructionArgs,
  RemovePoolInstructionAccounts,
} from "../sdk/generated/clone";
import * as CloneStaking from "../sdk/generated/clone-staking";
import {
  createInitializeInstruction,
  createMintAssetInstruction,
} from "../sdk/generated/mock-asset-faucet";
import { startAnchor, BanksClient } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";

const COLLATERAL_SCALE = 7;

const createTokenMintTx = async (
  provider: anchor.AnchorProvider,
  opts: { mint?: anchor.web3.Keypair; scale?: number; authority?: PublicKey }
): Promise<[Transaction, Keypair]> => {
  let tokenMint = opts.mint ?? anchor.web3.Keypair.generate();
  let tx = new Transaction().add(
    // create cln mint account
    SystemProgram.createAccount({
      fromPubkey: provider.publicKey!,
      newAccountPubkey: tokenMint.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
      programId: TOKEN_PROGRAM_ID,
    }),
    // init clone mint account
    createInitializeMintInstruction(
      tokenMint.publicKey,
      opts.scale ?? CLONE_TOKEN_SCALE,
      opts.authority ?? provider.publicKey!,
      null
    )
  );
  return [tx, tokenMint];
};

const sendAndConfirm = async function (context: BanksClient, tx: Transaction, payer?: Signer, signers: Signer[] = []) {
  tx.recentBlockhash = this.bankrunContext.blockhash;
  const _payer = payer ?? this.bankrunContext.payer;
  tx.sign(_payer);
  if (signers.length > 0) tx.partialSign(...signers)
  return await this.bankrunClient.processTransaction(tx);
}

//export const cloneTests = async function () {
  describe("clone protocol tests", async function () {

    before(async function () {
      // Setup Bankrun
      this.bankrunContext = await startAnchor(".", [], []);
      this.bankrunProvider = new BankrunProvider(this.bankrunContext);
      this.provider = new anchor.AnchorProvider(
        this.bankrunProvider.connection,
        new anchor.Wallet(this.bankrunContext.payer),
        {commitment: "confirmed"}
      )

      this.sendAndConfirm = async function (tx: Transaction, signers: Signer[] = []) {
        const tx_ = new Transaction();
        tx_.recentBlockhash = this.bankrunContext.lastBlockhash;
        tx_.add(...tx.instructions)
        tx_.sign(this.bankrunContext.payer);
        if (signers.length > 0) tx_.partialSign(...signers)
        return await this.bankrunContext.banksClient.processTransaction(tx_);
      }
      // Setup program IDs
      anchor.setProvider(this.provider);
      this.walletPubkey = this.bankrunContext.payer.publicKey//provider.publicKey!;
      this.cloneProgramId = anchor.workspace.Clone.programId;
      this.pythProgramId = anchor.workspace.Pyth.programId;
      this.cloneStakingProgramId = anchor.workspace.CloneStaking.programId;
      this.mockAssetFaucetProgramId = anchor.workspace.MockAssetFaucet.programId;

      // Generate Keypairs
      this.mockUSDCMint = anchor.web3.Keypair.generate();
      this.treasuryAddress = anchor.web3.Keypair.generate();
      this.clnTokenMint = anchor.web3.Keypair.generate();
      this.mockAssetMint = anchor.web3.Keypair.generate();
      this.usdcPriceKp = anchor.web3.Keypair.generate();
      this.pool0PriceKp = anchor.web3.Keypair.generate();

      // Setup constants
      this.healthScoreCoefficient = 110;
      this.ilHealthScoreCoefficient = 130;
      this.liquidatorFee = 500; // in bps
      this.poolTradingFee = 200;
      this.treasuryTradingFee = 100;
      this.tier0 = {
        minStakeRequirement: new BN(1000),
        lpTradingFeeBps: 15,
        treasuryTradingFeeBps: 10,
      };

      // Calculate PDAs
      this.cloneAccountAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("clone")],
        this.cloneProgramId
      )[0];
      this.cloneStakingAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("clone-staking")],
        this.cloneStakingProgramId
      )[0];
      this.clnTokenVault = getAssociatedTokenAddressSync(
        this.clnTokenMint.publicKey,
        this.cloneStakingAddress,
        true
      );
      this.userClnTokenAddress = getAssociatedTokenAddressSync(
        this.clnTokenMint.publicKey,
        this.walletPubkey
      );
      this.userStakingAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), this.walletPubkey.toBuffer()],
        this.cloneStakingProgramId
      )[0];

  });

    it("to scale test", function () {
      assert.isTrue(toCloneScale(28.15561224).toString() === "2815561224");
      assert.isTrue(toCloneScale(28.15561224999).toString() === "2815561224");
      assert.isTrue(toCloneScale(28.1556).toString() === "2815560000");
      assert.isTrue(
        toCloneScale(2815561224).toString() === "281556122400000000"
      );
      assert.isTrue(toCloneScale(0.2815561224).toString() === "28155612");
      assert.isTrue(toCloneScale(28.05561224).toString() === "2805561224");
    });

    it("initialize staking program + initialize tier + add stake", async function () {
      const [createMintTx, mintKeypair] = await createTokenMintTx(this.provider, { mint: this.clnTokenMint });
      await this.sendAndConfirm(createMintTx, [mintKeypair]);
      console.log("MINT created")

      let tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          this.provider.publicKey!,
          this.clnTokenVault,
          this.cloneStakingAddress,
          this.clnTokenMint.publicKey
        ),
        CloneStaking.createInitializeInstruction(
          {
            admin: this.provider.publicKey!,
            cloneStaking: this.cloneStakingAddress,
            clnTokenMint: this.clnTokenMint.publicKey,
            clnTokenVault: this.clnTokenVault,
          },
          {
            stakingPeriodSlots: new BN(1000),
          }
        ),
        CloneStaking.createUpdateStakingParamsInstruction(
          {
            admin: this.provider.publicKey!,
            cloneStaking: this.cloneStakingAddress,
          },
          {
            params: {
              __kind: "Tier",
              numTiers: 1,
              index: 0,
              stakeRequirement: this.tier0.minStakeRequirement,
              lpTradingFeeBps: this.tier0.lpTradingFeeBps,
              treasuryTradingFeeBps: this.tier0.treasuryTradingFeeBps,
            },
          }
        )
      );
      await this.sendAndConfirm(tx);

      // Mint cln tokens to user.
      let mintTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          this.walletPubkey,
          this.userClnTokenAddress,
          this.walletPubkey,
          this.clnTokenMint.publicKey
        ),
        createMintToCheckedInstruction(
          this.clnTokenMint.publicKey,
          this.userClnTokenAddress,
          this.walletPubkey,
          this.tier0.minStakeRequirement.toNumber(),
          CLONE_TOKEN_SCALE
        ),
        CloneStaking.createAddStakeInstruction(
          {
            user: this.provider.publicKey!,
            userAccount: this.userStakingAddress,
            cloneStaking: this.cloneStakingAddress,
            clnTokenMint: this.clnTokenMint.publicKey,
            clnTokenVault: this.clnTokenVault,
            userClnTokenAccount: this.userClnTokenAddress,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          {
            amount: this.tier0.minStakeRequirement,
          }
        )
      );

      await this.sendAndConfirm(mintTx);

      let userStakingAccount = await CloneStaking.User.fromAccountAddress(
        this.provider.connection,
        this.userStakingAddress
      );
      assert.equal(
        Number(userStakingAccount.stakedTokens),
        this.tier0.minStakeRequirement.toNumber()
      );
    });

    it("mock usdc initialized as faucet", async function () {
      let usdcMintAmount = 1_000_000_000;

      let [faucetAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("faucet")],
        this.mockAssetFaucetProgramId
      );

      const [createMintTx, _mintKeypair] = await createTokenMintTx(this.provider, {
        mint: this.mockUSDCMint,
        scale: COLLATERAL_SCALE,
        authority: faucetAddress,
      });

      const usdcAssociatedTokenAccount = getAssociatedTokenAddressSync(
        this.mockUSDCMint.publicKey,
        this.provider.publicKey!,
      )

      const createUsdcAtaIx = createAssociatedTokenAccountInstruction(
        this.provider.publicKey!,
        usdcAssociatedTokenAccount,
        this.provider.publicKey!,
        this.mockUSDCMint.publicKey,
      );

      let tx = new Transaction().add(
        createMintTx,
        createUsdcAtaIx
      );

      await this.sendAndConfirm(tx, [this.mockUSDCMint]);

      tx = new Transaction().add(
        createInitializeInstruction({
          payer: this.provider.publicKey!,
          faucet: faucetAddress,
          mint: this.mockUSDCMint.publicKey,
        }),
        createMintAssetInstruction(
          {
            minter: this.provider.publicKey!,
            faucet: faucetAddress,
            mint: this.mockUSDCMint.publicKey,
            tokenAccount: usdcAssociatedTokenAccount,
          },
          { amount: toScale(usdcMintAmount, COLLATERAL_SCALE) }
        )
      );

      await this.sendAndConfirm(tx);
    });

    it("mock asset initialized!", async function () {
      const [createMintTx, _mintKeypair] = await createTokenMintTx(this.provider, {
        mint: this.mockAssetMint,
        scale: CLONE_TOKEN_SCALE,
      });

      let assetAssociatedTokenAccount = getAssociatedTokenAddressSync(
        this.mockAssetMint.publicKey,
        this.provider.publicKey!,
      );
      let assetMintAmount = 400_000;
      await this.sendAndConfirm(
        new Transaction().add(
          createMintTx,
          createAssociatedTokenAccountInstruction(
            this.provider.publicKey!,
            assetAssociatedTokenAccount,
            this.provider.publicKey!,
            this.mockAssetMint.publicKey
          ),
          createMintToCheckedInstruction(
            this.mockAssetMint.publicKey,
            assetAssociatedTokenAccount,
            this.provider.publicKey!,
            toScale(assetMintAmount, CLONE_TOKEN_SCALE).toNumber(),
            CLONE_TOKEN_SCALE
          )
        ),
        [this.mockAssetMint]
      );
    });

    it("clone initialized!", async function () {
      let tx = await CloneClient.createInitializeCloneTransaction(
        this.provider.publicKey!,
        this.cloneProgramId,
        this.liquidatorFee,
        this.liquidatorFee,
        this.liquidatorFee,
        this.treasuryAddress,
        this.mockUSDCMint.publicKey,
        0,
        95
      )
      await this.sendAndConfirm(tx);

      let account = await CloneAccount.fromAccountAddress(
        this.provider.connection,
        this.cloneAccountAddress
      );
      this.cloneClient = new CloneClient(this.provider, account, this.cloneProgramId);
    });

    return;

    it("add auth test", async function () {
      const address = anchor.web3.Keypair.generate().publicKey;
      await cloneClient.updateCloneParameters({
        params: {
          __kind: "AddAuth",
          address,
        },
      });

      let clone = await CloneAccount.fromAccountAddress(
        provider.connection,
        cloneAccountAddress
      );
      let foundAddress = clone.auth.find((v) => {
        return v.equals(address);
      });
      assert(foundAddress !== undefined, "Auth not added");

      await cloneClient.updateCloneParameters({
        params: {
          __kind: "RemoveAuth",
          address,
        },
      });

      clone = await CloneAccount.fromAccountAddress(
        provider.connection,
        cloneAccountAddress
      );
      foundAddress = clone.auth.find((v) => {
        return v.equals(address);
      });
      assert(foundAddress === undefined, "Auth not removed");
    });

    it("initialize mock feeds and oracles", async function () {
      const usdcPriceFeed = await createPriceFeed(
        provider,
        pythProgramId,
        1,
        -7,
        usdcPriceKp
      );
      const pool0PriceFeed = await createPriceFeed(
        provider,
        pythProgramId,
        10,
        -8,
        pool0PriceKp
      );
      await cloneClient.updateOracles({
        params: {
          __kind: "Add",
          source: OracleSource.PYTH,
          address: usdcPriceFeed,
          rescaleFactor: null,
        },
      });
      await cloneClient.updateOracles({
        params: {
          __kind: "Add",
          source: OracleSource.PYTH,
          address: pool0PriceFeed,
          rescaleFactor: null,
        },
      });
      let oracles = await cloneClient.getOracles();

      await provider.sendAndConfirm(
        new Transaction().add(cloneClient.updatePricesInstruction(oracles))
      );
      oracles = await cloneClient.getOracles();
      assert.equal(oracles.oracles.length, 2);

      let oracle1 = oracles.oracles[0];
      let oracle1Price = fromScale(oracle1.price, oracle1.expo);
      assert.equal(oracle1Price, 1);

      let oracle2 = oracles.oracles[1];
      let oracle2Price = fromScale(oracle2.price, oracle2.expo);
      assert.equal(oracle2Price, 10);
    });

    it("add and check pyth oracle", async function () {
      let pythFeedAddress = new PublicKey(
        "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG"
      );
      await cloneClient.updateOracles({
        params: {
          __kind: "Add",
          source: OracleSource.PYTH,
          address: pythFeedAddress,
          rescaleFactor: null,
        },
      });
      let oracles = await cloneClient.getOracles();
      assert.equal(oracles.oracles.length, 3);
      // Update prices
      await provider.sendAndConfirm(
        new Transaction().add(cloneClient.updatePricesInstruction(oracles))
      );
      oracles = await cloneClient.getOracles();

      let pythOracle = oracles.oracles[2];
      let price = fromScale(pythOracle.price, pythOracle.expo);

      assert.isTrue(price !== 0, "pyth price is not updated");
    });

    it("add and check switchboard oracle", async function () {
      let switchboardFeedAddress = new PublicKey(
        "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
      );
      await cloneClient.updateOracles({
        params: {
          __kind: "Add",
          source: OracleSource.SWITCHBOARD,
          address: switchboardFeedAddress,
          rescaleFactor: null,
        },
      });
      let oracles = await cloneClient.getOracles();
      assert.equal(oracles.oracles.length, 4);
      // Update prices
      await provider.sendAndConfirm(
        new Transaction().add(cloneClient.updatePricesInstruction(oracles))
      );
      oracles = await cloneClient.getOracles();

      let switchboardOracle = oracles.oracles[3];
      let price = fromScale(switchboardOracle.price, switchboardOracle.expo);

      assert.isTrue(price !== 0, "switchboard price is not updated");
    });

    it("pools initialized!", async function () {
      await cloneClient.addPool(
        150,
        200,
        poolTradingFee,
        treasuryTradingFee,
        ilHealthScoreCoefficient,
        healthScoreCoefficient,
        1,
        mockAssetMint.publicKey
      );

      let pools = await cloneClient.getPools();
      assert.equal(pools.pools.length, 1);
    });

    it("user initialized!", async function () {
      let tx = new Transaction().add(cloneClient.initializeUserInstruction());
      await cloneClient.provider.sendAndConfirm!(tx);
    });

    it("price updated!", async function () {
      let oracles = await cloneClient.getOracles();
      let ix = cloneClient.updatePricesInstruction(oracles);
      await provider.sendAndConfirm(new Transaction().add(ix));
    });

    it("create metaplex metadata account", async function () {
      let pools = await cloneClient.getPools();
      let mint = pools.pools[0].assetInfo.onassetMint;

      const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      );

      // Create metadata PDA
      const metadataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )[0];

      let accounts: CreateTokenMetadataInstructionAccounts = {
        admin: this.provider.publicKey!,
        clone: cloneAccountAddress,
        mint,
        metaplexProgram: TOKEN_METADATA_PROGRAM_ID,
        metadata: metadataAddress,
      };
      let ix = createCreateTokenMetadataInstruction(accounts, {
        metadataArgs: {
          name: "TEST CLONE TOKEN",
          symbol: "TCT",
          uri: "Some URI here"
        },
      } as CreateTokenMetadataInstructionArgs);

        await provider.sendAndConfirm(new Transaction().add(ix));
      // detach the validator and check the metadata account using the explorer
    });
    return;

    let mintAmount = 10;
    let usdctoDeposit = 2000;

    it("onasset borrowed!", async function () {
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      let pool = pools.pools[0];

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      const startingOnAsset = fromCloneScale(onassetTokenAccountInfo.amount);
      mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockUSDCMint.publicKey
      );
      const startingMockUSDC = fromScale(
        mockUSDCTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);

      let ix = cloneClient.initializeBorrowPositionInstruction(
        pools,
        mockUSDCTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        toCloneScale(mintAmount),
        toScale(usdctoDeposit, 7),
        0
      );
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(ix)
      );

      pools = await cloneClient.getPools();
      pool = pools.pools[0];

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockUSDCMint.publicKey
      );

      assert.equal(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnAsset + mintAmount,
        "check onasset token amount"
      );
      assert.equal(
        fromScale(mockUSDCTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingMockUSDC - usdctoDeposit,
        "check USDC amount"
      );

      let userAccount = await cloneClient.getUserAccount();

      const borrowPosition = userAccount.borrows[0];

      assert.equal(
        fromCloneScale(borrowPosition.borrowedOnasset),
        mintAmount,
        "stored minted amount"
      );
      assert.equal(
        fromScale(borrowPosition.collateralAmount, 7),
        usdctoDeposit,
        "stored collateral amount"
      );
    });

    it("full withdraw and close borrow position!", async function () {
      let pools = await cloneClient.getPools();
      let pool = pools.pools[0];
      let vault = await provider.connection.getTokenAccountBalance(
        cloneClient.clone.collateral.vault,
        "recent"
      );
      const startingVaultAmount = vault.value.uiAmount!;
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockUSDCMint.publicKey
      );
      const startingUsdcAmount = fromScale(
        mockUSDCTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      let borrowIndex = 0;
      let userAccount = await cloneClient.getUserAccount();
      let borrowPosition = userAccount.borrows[borrowIndex];

      const collateralWithdrawal = fromScale(
        borrowPosition.collateralAmount,
        COLLATERAL_SCALE
      );
      const payBorrowDebtIx = cloneClient.payBorrowDebtInstruction(
        pools,
        userAccount,
        onassetTokenAccountInfo.address,
        new BN(borrowPosition.borrowedOnasset),
        borrowIndex
      );

      const withdrawCollateralFromBorrowIx =
        cloneClient.withdrawCollateralFromBorrowInstruction(
          borrowIndex,
          mockUSDCTokenAccountInfo.address,
          new BN(borrowPosition.collateralAmount)
        );
      const oracles = await cloneClient.getOracles();
      const updatePricesIx = cloneClient.updatePricesInstruction(oracles);

      let tx = new Transaction();
      tx.add(updatePricesIx)
        .add(payBorrowDebtIx)
        .add(withdrawCollateralFromBorrowIx);

      await provider.sendAndConfirm(tx);

      pools = await cloneClient.getPools();
      pool = pools.pools[0];

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockUSDCMint.publicKey
      );

      assert.equal(
        Number(onassetTokenAccountInfo.amount),
        0,
        "check onasset token amount"
      );
      assert.equal(
        fromScale(mockUSDCTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingUsdcAmount +
          fromScale(borrowPosition.collateralAmount, COLLATERAL_SCALE),
        "check USDC amount"
      );

      vault = await provider.connection.getTokenAccountBalance(
        cloneClient.clone.collateral.vault,
        "recent"
      );

      assert.equal(
        vault.value!.uiAmount,
        startingVaultAmount - collateralWithdrawal,
        "check usdc vault amount"
      );

      // Recreate original position.
      let ix = cloneClient.initializeBorrowPositionInstruction(
        pools,
        mockUSDCTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        toCloneScale(mintAmount),
        toScale(usdctoDeposit, COLLATERAL_SCALE),
        0
      );
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(ix)
      );
    });

    it("mint collateral added!", async function () {
      mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockUSDCMint.publicKey
      );
      const startingUsdcAmount = fromScale(
        mockUSDCTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      let additionalCollateral = 100;

      let ix = cloneClient.addCollateralToBorrowInstruction(
        0,
        mockUSDCTokenAccountInfo.address,
        toScale(additionalCollateral, COLLATERAL_SCALE)
      );
      await provider.sendAndConfirm(new Transaction().add(ix));

      mockUSDCTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockUSDCMint.publicKey
      );

      assert.equal(
        fromScale(mockUSDCTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingUsdcAmount - additionalCollateral,
        "check USDC amount"
      );
    });

    it("more onasset minted!", async function () {
      const pools = await cloneClient.getPools();
      const userAccount = await cloneClient.getUserAccount();
      const oracles = await cloneClient.getOracles();

      const pool = pools.pools[0];
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      const startingBalance = fromCloneScale(onassetTokenAccountInfo.amount);

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);
      let moreToBorrow = 0.05;

      let ix = cloneClient.borrowMoreInstruction(
        pools,
        userAccount,
        onassetTokenAccountInfo.address,
        toCloneScale(moreToBorrow),
        0
      );
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(ix)
      );

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.closeTo(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingBalance + moreToBorrow,
        1e-8,
        "check user onasset balance"
      );
    });

    it("borrow position liquidation", async function () {
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      let userAccount = await cloneClient.getUserAccount();
      let userborrowPositions = userAccount.borrows;
      let positionIndex = 0;
      let position = userborrowPositions[positionIndex];
      let poolIndex = Number(position.poolIndex);
      let collateral = cloneClient.clone.collateral;
      let pool = pools.pools[poolIndex];
      let oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];
      let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );
      let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      // Set prices
      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);
      let oraclePrice = fromScale(oracle.price, oracle.expo);
      let collateralAmount = fromScale(
        position.collateralAmount,
        collateral.scale
      );
      let priceThreshold =
        (collateralAmount *
          fromScale(cloneClient.clone.collateral.collateralizationRatio, 2)) /
        (fromScale(pool.assetInfo.minOvercollateralRatio, 2) *
          fromCloneScale(position.borrowedOnasset));

      await setPrice(provider, priceThreshold * 1.1, pool0PriceKp.publicKey);

      let initialOvercollateralRatio =
        collateralAmount /
        (fromCloneScale(position.borrowedOnasset) * oraclePrice);

      let tx = new Transaction().add(
        updatePricesIx,
        cloneClient.liquidateBorrowPositionInstruction(
          pools,
          userAccount,
          cloneClient.provider.publicKey!,
          positionIndex,
          toCloneScale(1),
          collateralTokenAccountInfo.address,
          onassetTokenAccountInfo.address
        )
      );

      let failedSimulation = false;
      try {
        await provider.simulate(tx);
      } catch (error) {
        failedSimulation = true;
      }
      assert.isTrue(failedSimulation, "simulation should have failed");

      // Add auth
      await cloneClient.updateCloneParameters({
        params: {
          __kind: "AddAuth",
          address: this.provider.publicKey!,
        },
      });

      await cloneClient.provider.sendAndConfirm!(tx);
      userAccount = await cloneClient.getUserAccount();
      userborrowPositions = userAccount.borrows;
      position = userborrowPositions[positionIndex];
      collateralAmount = fromScale(position.collateralAmount, collateral.scale);

      let finalOvercollateralRatio =
        collateralAmount /
        (fromCloneScale(position.borrowedOnasset) * oraclePrice);

      assert.isAbove(
        finalOvercollateralRatio,
        initialOvercollateralRatio,
        "Liquidation did not finish!"
      );

      // Remove admin from auth and allow nonauth liquidations.
      await cloneClient.updateCloneParameters({
        params: {
          __kind: "RemoveAuth",
          address: this.provider.publicKey!,
        },
      });

      await cloneClient.updateCloneParameters({
        params: {
          __kind: "NonAuthLiquidationsEnabled",
          value: true,
        },
      });
    });

    it("comet collateral added!", async function () {
      const collateralToAdd = 100_000_000;
      let userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      const collateral = cloneClient.clone.collateral;
      let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );

      const startingCollateralWallet = fromScale(
        collateralTokenAccountInfo.amount,
        collateral.scale
      );
      let vault = await provider.connection.getTokenAccountBalance(
        collateral.vault,
        "recent"
      );
      const startingVaultBalance = vault.value!.uiAmount!;

      let ix = cloneClient.addCollateralToCometInstruction(
        collateralTokenAccountInfo.address,
        toScale(collateralToAdd, 7)
      );
      await provider.sendAndConfirm(new Transaction().add(ix));
      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );
      const endingCollateralWallet = fromScale(
        collateralTokenAccountInfo.amount,
        collateral.scale
      );

      assert.equal(
        startingCollateralWallet - endingCollateralWallet,
        collateralToAdd,
        "check user onUSD"
      );

      vault = await provider.connection.getTokenAccountBalance(
        collateral.vault,
        "recent"
      );

      assert.equal(
        vault.value.uiAmount! - startingVaultBalance!,
        collateralToAdd,
        "check vault balance"
      );
    });

    it("comet collateral withdrawn!", async function () {
      let userAccount = await cloneClient.getUserAccount();
      const oracles = await cloneClient.getOracles();
      let comet = userAccount.comet;
      const collateral = cloneClient.clone.collateral;

      let vault = await provider.connection.getTokenAccountBalance(
        collateral.vault,
        "recent"
      );
      let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );
      const startingCollateralWallet = fromScale(
        collateralTokenAccountInfo.amount,
        collateral.scale
      );
      const collateralToWithdraw = 500;
      const startingVaultBalance = vault.value.uiAmount!;

      let updatePriceIx = cloneClient.updatePricesInstruction(oracles);
      let ix = cloneClient.withdrawCollateralFromCometInstruction(
        collateralTokenAccountInfo.address,
        toScale(collateralToWithdraw, 7)
      );
      await provider.sendAndConfirm(new Transaction().add(updatePriceIx, ix));

      vault = await provider.connection.getTokenAccountBalance(
        collateral.vault,
        "recent"
      );

      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );
      const endingCollateralWallet = fromScale(
        collateralTokenAccountInfo.amount,
        collateral.scale
      );

      assert.equal(
        endingCollateralWallet - startingCollateralWallet,
        collateralToWithdraw,
        "check user onUSD"
      );

      assert.equal(
        startingVaultBalance - vault.value!.uiAmount!,
        collateralToWithdraw,
        "check vault balance"
      );
    });

    it("comet liquidity added!", async function () {
      const collateral = cloneClient.clone.collateral;
      const oracles = await cloneClient.getOracles();
      let pools = await cloneClient.getPools();
      const initialPool = pools.pools[0];
      const liquidityToAdd = 2_000_000;

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);

      let ix = cloneClient.addLiquidityToCometInstruction(
        toScale(liquidityToAdd, collateral.scale),
        0
      );
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(ix)
      );

      pools = await cloneClient.getPools();
      const finalPool = pools.pools[0];
      let user = await cloneClient.getUserAccount();
      const finalUserLiquidity = fromScale(
        user.comet.positions[0].committedCollateralLiquidity,
        collateral.scale
      );

      assert.equal(
        finalUserLiquidity,
        liquidityToAdd,
        "check user supplied liquidity"
      );

      assert.closeTo(
        fromScale(finalPool.committedCollateralLiquidity, collateral.scale) -
          fromScale(initialPool.committedCollateralLiquidity, collateral.scale),
        liquidityToAdd,
        1e-6,
        "check lp supply pool balance"
      );
    });

    it("comet health check", async function () {
      let userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      let healthScore = getHealthScore(
        oracles,
        pools,
        comet,
        cloneClient.clone.collateral
      );

      assert.closeTo(healthScore.healthScore, 97, 1, "check health score.");

      let params: PoolParameters = {
        __kind: "PositionHealthScoreCoefficient",
        value: healthScoreCoefficient * 2,
      };

      await cloneClient.updatePoolParameters({
        index: 0,
        params: params,
      });

      params = {
        __kind: "IlHealthScoreCoefficient",
        value: ilHealthScoreCoefficient * 2,
      };

      await cloneClient.updatePoolParameters({
        index: 0,
        params: params,
      });

      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;
      pools = await cloneClient.getPools();
      oracles = await cloneClient.getOracles();
      healthScore = getHealthScore(
        oracles,
        pools,
        comet,
        cloneClient.clone.collateral
      );
      assert.closeTo(healthScore.healthScore, 95, 1, "check health score.");
    });

    it("comet liquidity withdrawn!", async function () {
      const pools = await cloneClient.getPools();
      let userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      const positionIndex = 0;
      let position = comet.positions[positionIndex];
      const poolIndex = Number(position.poolIndex);
      const pool = pools.pools[poolIndex];
      const withdrawAmount = 10;

      let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      const startingCollateralAmount = fromCloneScale(
        collateralTokenAccountInfo.amount
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      const startingOnassetAmount = fromCloneScale(
        onassetTokenAccountInfo.amount
      );

      let ix = cloneClient.withdrawLiquidityFromCometInstruction(
        toCloneScale(withdrawAmount),
        positionIndex
      );
      await provider.sendAndConfirm(new Transaction().add(ix));

      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;
      position = comet.positions[positionIndex];

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.isAtLeast(
        fromCloneScale(collateralTokenAccountInfo.amount),
        startingCollateralAmount,
        "check onusd user balance"
      );

      assert.isAtLeast(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnassetAmount,
        "check onasset user balance"
      );
    });

    it("comet position closed and reinitialized!", async function () {
      const pools = await cloneClient.getPools();
      let userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      let numCometPositions = comet.positions.length;
      const positionIndex = 0;
      let position = comet.positions[positionIndex];
      const poolIndex = Number(position.poolIndex);
      const pool = pools.pools[poolIndex];

      let ix = cloneClient.withdrawLiquidityFromCometInstruction(
        new BN(position.committedCollateralLiquidity),
        positionIndex
      );
      let removeIx = cloneClient.removeCometPositionInstruction(positionIndex);
      await provider.sendAndConfirm(new Transaction().add(ix, removeIx));

      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;
      assert.equal(
        comet.positions.length,
        numCometPositions - 1,
        "check comet position removed"
      );

      await provider.sendAndConfirm(
        new Transaction().add(
          cloneClient.updatePricesInstruction(await cloneClient.getOracles()),
          cloneClient.addLiquidityToCometInstruction(
            new BN(position.committedCollateralLiquidity),
            poolIndex
          )
        )
      );
    });

    it("onasset bought!", async function () {
      let poolIndex = 0;
      let pools = await cloneClient.getPools();
      let pool = pools.pools[poolIndex];
      let oracles = await cloneClient.getOracles();
      let oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      let startingCollateralBalance = fromScale(
        collateralTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      let onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      let startingOnassetBalance = fromCloneScale(
        onassetTokenAccountInfo.amount
      );

      const treasuryOnassetAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          pool.assetInfo.onassetMint,
          treasuryAddress.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      const treasuryCollateralAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          cloneClient.clone.collateral.mint,
          treasuryAddress.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      await cloneClient.provider.sendAndConfirm!(
        new Transaction()
          .add(
            await createAssociatedTokenAccountInstruction(
              cloneClient.provider.publicKey!,
              treasuryOnassetAssociatedTokenAddress,
              treasuryAddress.publicKey,
              pool.assetInfo.onassetMint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          )
          .add(
            await createAssociatedTokenAccountInstruction(
              cloneClient.provider.publicKey!,
              treasuryCollateralAssociatedTokenAddress,
              treasuryAddress.publicKey,
              cloneClient.clone.collateral.mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          )
      );

      treasuryOnassetTokenAccount = await getAccount(
        cloneClient.provider.connection,
        treasuryOnassetAssociatedTokenAddress,
        "recent"
      );
      treasuryCollateralTokenAccount = await getAccount(
        cloneClient.provider.connection,
        treasuryCollateralAssociatedTokenAddress,
        "recent"
      );
      let updatePriceIx = cloneClient.updatePricesInstruction(oracles);
      const amountToBuy = 100;
      let executionEst = calculateSwapExecution(
        amountToBuy,
        false,
        false,
        fromScale(pool.collateralIld, COLLATERAL_SCALE),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        fromScale(pool.liquidityTradingFeeBps, 4),
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(oracle.price, oracle.expo),
        cloneClient.clone.collateral
      );

      // Buy via specified onasset for output
      let buyIx = cloneClient.swapInstruction(
        poolIndex,
        toCloneScale(amountToBuy),
        false,
        false,
        toScale(executionEst.result * 1.005, COLLATERAL_SCALE),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePriceIx).add(buyIx)
      );

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      const endingCollateralWallet = fromScale(
        collateralTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.closeTo(
        endingCollateralWallet,
        startingCollateralBalance - executionEst.result,
        1e-7,
        "check user collateral balance."
      );
      assert.closeTo(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnassetBalance + amountToBuy,
        1e-7,
        "check user onAsset balance."
      );
      startingCollateralBalance = fromScale(
        collateralTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      startingOnassetBalance = fromCloneScale(onassetTokenAccountInfo.amount);
      pools = await cloneClient.getPools();
      oracles = await cloneClient.getOracles();
      pool = pools.pools[poolIndex];
      oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];
      // Second buy, via specified onUsd for input
      const collateralToConvert = 200;
      executionEst = calculateSwapExecution(
        collateralToConvert,
        true,
        true,
        fromScale(pool.collateralIld, COLLATERAL_SCALE),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        fromScale(pool.liquidityTradingFeeBps, 4),
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(oracle.price, oracle.expo),
        cloneClient.clone.collateral
      );
      // Buy via specified onasset for output
      let convertIx = cloneClient.swapInstruction(
        poolIndex,
        toScale(collateralToConvert, COLLATERAL_SCALE),
        true,
        true,
        toCloneScale(executionEst.result * 0.995),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePriceIx).add(convertIx)
      );

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.closeTo(
        fromScale(collateralTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingCollateralBalance - collateralToConvert,
        1e-7,
        "check user onusd balance."
      );
      assert.closeTo(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnassetBalance + executionEst.result,
        1e-7,
        "check user onAsset balance."
      );
    });

    it("onasset sold!", async function () {
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      const poolIndex = 0;
      let pool = pools.pools[poolIndex];
      let oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      let startingCollateralBalance = fromScale(
        collateralTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      let startingOnassetBalance = fromCloneScale(
        onassetTokenAccountInfo.amount
      );
      let updatePriceIx = cloneClient.updatePricesInstruction(oracles);
      let amountToSell = 100;
      // Test with user CLN stake tier 0.
      let executionEst = calculateSwapExecution(
        amountToSell,
        true,
        false,
        fromScale(pool.collateralIld, COLLATERAL_SCALE),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        tier0.lpTradingFeeBps * 1e-4,
        tier0.treasuryTradingFeeBps * 1e-4,
        fromScale(oracle.price, oracle.expo),
        cloneClient.clone.collateral
      );
      // Sell specifying input (onAsset)
      let sellIx = cloneClient.swapInstruction(
        poolIndex,
        toCloneScale(amountToSell),
        true,
        false,
        toScale(executionEst.result * 0.995, COLLATERAL_SCALE),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address,
        {
          cloneStaking: cloneStakingAddress,
          cloneStakingProgram: cloneStakingProgramId,
          userStakingAccount: userStakingAddress,
        }
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePriceIx).add(sellIx)
      );

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.closeTo(
        fromScale(collateralTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingCollateralBalance + executionEst.result,
        1e-6,
        "check user onusd balance"
      );
      assert.closeTo(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnassetBalance - amountToSell,
        1e-6,
        "check user onAsset balance"
      );

      startingCollateralBalance = fromScale(
        collateralTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );
      startingOnassetBalance = fromCloneScale(onassetTokenAccountInfo.amount);
      pools = await cloneClient.getPools();
      pool = pools.pools[poolIndex];
      oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      // Second sell, via specified onUsd for output
      const collateralToReceive = 1000;
      executionEst = calculateSwapExecution(
        collateralToReceive,
        false,
        true,
        fromScale(pool.collateralIld, COLLATERAL_SCALE),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        fromScale(pool.liquidityTradingFeeBps, 4),
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(oracle.price, oracle.expo),
        cloneClient.clone.collateral
      );
      // Buy via specified onasset for output
      let convertIx = cloneClient.swapInstruction(
        poolIndex,
        toScale(collateralToReceive, COLLATERAL_SCALE),
        false,
        true,
        toCloneScale(executionEst.result * 1.005),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePriceIx).add(convertIx)
      );

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.closeTo(
        fromScale(collateralTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingCollateralBalance + collateralToReceive,
        1e-7,
        "check user onusd balance."
      );
      assert.closeTo(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnassetBalance - executionEst.result,
        1e-7,
        "check user onAsset balance."
      );
    });

    it("withdraw all staked CLN", async function () {
      let userStakingAccount = await CloneStaking.User.fromAccountAddress(
        provider.connection,
        userStakingAddress
      );

      const getSlot = async function () {
        return await provider.connection.getSlot("finalized");
      };

      while ((await getSlot()) < Number(userStakingAccount.minSlotWithdrawal)) {
        sleep(1000);
      }

      await provider.sendAndConfirm(
        new Transaction().add(
          CloneStaking.createWithdrawStakeInstruction(
            {
              user: this.provider.publicKey!,
              userAccount: userStakingAddress,
              cloneStaking: cloneStakingAddress,
              clnTokenMint: clnTokenMint.publicKey,
              clnTokenVault: clnTokenVault,
              userClnTokenAccount: userClnTokenAddress,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: anchor.web3.SystemProgram.programId,
            },
            {
              amount: userStakingAccount.stakedTokens,
            }
          )
        )
      );

      userStakingAccount = await CloneStaking.User.fromAccountAddress(
        provider.connection,
        userStakingAddress
      );
      assert.equal(Number(userStakingAccount.stakedTokens), 0);
    });

    it("wrap assets and unwrap onassets", async function () {
      const poolIndex = 0;
      const pools = await cloneClient.getPools();
      const pool = pools.pools[poolIndex];

      let mockAssetAssociatedTokenAccount =
        await getOrCreateAssociatedTokenAccount(
          cloneClient.provider,
          mockAssetMint.publicKey
        );

      let onassetAssociatedTokenAccount =
        await getOrCreateAssociatedTokenAccount(
          cloneClient.provider,
          pool.assetInfo.onassetMint
        );

      let startingAssetBalance = fromCloneScale(
        mockAssetAssociatedTokenAccount.amount
      );
      let startingOnassetBalance = fromCloneScale(
        onassetAssociatedTokenAccount.amount
      );

      let amountToWrap = 100000;

      // Wrap to onasset
      let tx = new Transaction().add(
        cloneClient.wrapAssetInstruction(
          pools,
          toCloneScale(amountToWrap),
          poolIndex,
          mockAssetMint.publicKey,
          mockAssetAssociatedTokenAccount.address,
          onassetAssociatedTokenAccount.address
        )
      );
      await provider.sendAndConfirm(tx);

      mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockAssetMint.publicKey
      );

      onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      let endingMockAssetBalance = fromCloneScale(
        mockAssetAssociatedTokenAccount.amount
      );
      let endingOnassetBalance = fromCloneScale(
        onassetAssociatedTokenAccount.amount
      );

      assert.equal(
        startingAssetBalance - endingMockAssetBalance,
        amountToWrap,
        "check asset"
      );
      assert.equal(
        endingOnassetBalance - startingOnassetBalance,
        amountToWrap,
        "check onasset"
      );

      // Unwrap to asset
      let unwrapAmount = 1000;
      tx = new Transaction().add(
        cloneClient.unwrapOnassetInstruction(
          pools,
          toCloneScale(unwrapAmount),
          poolIndex,
          mockAssetMint.publicKey,
          mockAssetAssociatedTokenAccount.address,
          onassetAssociatedTokenAccount.address
        )
      );
      await provider.sendAndConfirm(tx);

      mockAssetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        mockAssetMint.publicKey
      );

      onassetAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.equal(
        fromCloneScale(mockAssetAssociatedTokenAccount.amount) -
          endingMockAssetBalance,
        unwrapAmount
      );
      assert.equal(
        endingOnassetBalance -
          fromCloneScale(onassetAssociatedTokenAccount.amount),
        unwrapAmount
      );
    });

    it("pay ILD + claim rewards", async function () {
      let userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      let startingCometCollateral = comet.collateralAmount;
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      let collateral = cloneClient.clone.collateral;
      let cometPositionIndex = 0;
      let ildInfo = getILD(collateral, pools, oracles, comet)[
        cometPositionIndex
      ];
      let pool =
        pools.pools[Number(comet.positions[cometPositionIndex].poolIndex)];

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      let startingCollateralAmount = fromScale(
        collateralTokenAccountInfo.amount,
        COLLATERAL_SCALE
      );

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );
      let startingOnassetAmount = fromCloneScale(
        onassetTokenAccountInfo.amount
      );
      let collateralPaymentFromWallet = toScale(
        ildInfo.collateralILD / 2,
        COLLATERAL_SCALE
      );
      let paymentFromCometCollateral = toScale(
        ildInfo.collateralILD,
        COLLATERAL_SCALE
      ).sub(collateralPaymentFromWallet);

      // Pay ILD
      let payILDIx0 = cloneClient.payCometILDInstruction(
        pools,
        userAccount,
        cometPositionIndex,
        collateralPaymentFromWallet,
        PaymentType.Collateral,
        onassetTokenAccountInfo.address,
        collateralTokenAccountInfo.address
      );
      let payILDIx1 = cloneClient.payCometILDInstruction(
        pools,
        userAccount,
        cometPositionIndex,
        paymentFromCometCollateral,
        PaymentType.CollateralFromWallet,
        onassetTokenAccountInfo.address,
        collateralTokenAccountInfo.address
      );

      // Collect rewards and pay down ILD
      let collectRewardIx = cloneClient.collectLpRewardsInstruction(
        pools,
        userAccount,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        cometPositionIndex
      );

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);

      await provider.sendAndConfirm!(
        new Transaction().add(
          updatePricesIx,
          payILDIx0,
          payILDIx1,
          collectRewardIx
        )
      );

      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;
      pools = await cloneClient.getPools();
      oracles = await cloneClient.getOracles();
      let finalIldInfo = getILD(collateral, pools, oracles, comet)[
        cometPositionIndex
      ];

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.equal(finalIldInfo.onAssetILD, 0, "onAsset ILD nonzero");
      assert.equal(finalIldInfo.collateralILD, 0, "onUsd ILD nonzero");

      assert.closeTo(
        Number(comet.collateralAmount),
        Number(startingCometCollateral) - paymentFromCometCollateral.toNumber(),
        1e-7,
        "check comet collateral"
      );

      assert.closeTo(
        fromScale(collateralTokenAccountInfo.amount, COLLATERAL_SCALE),
        startingCollateralAmount -
          fromScale(collateralPaymentFromWallet, COLLATERAL_SCALE),
        1e-6,
        "check collateral account balance"
      );

      assert.closeTo(
        fromCloneScale(onassetTokenAccountInfo.amount),
        startingOnassetAmount - ildInfo.onAssetILD,
        1e-6,
        "check onasset account balance"
      );
    });

    it("comet onasset liquidation", async function () {
      let poolIndex = 0;
      let collateral = cloneClient.clone.collateral;
      let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );
      let oracles = await cloneClient.getOracles();
      let pools = await cloneClient.getPools();
      let pool = pools.pools[poolIndex];
      let oracle = oracles.oracles[pool.assetInfo.oracleInfoIndex];

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);

      const treasuryOnassetAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          pool.assetInfo.onassetMint,
          treasuryAddress.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      const treasuryCollateralAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          cloneClient.clone.collateral.mint,
          treasuryAddress.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

      treasuryOnassetTokenAccount = await getAccount(
        cloneClient.provider.connection,
        treasuryOnassetAssociatedTokenAddress,
        "recent"
      );
      treasuryCollateralTokenAccount = await getAccount(
        cloneClient.provider.connection,
        treasuryCollateralAssociatedTokenAddress,
        "recent"
      );
      const collateralValueToBuy = 1000;
      let executionEst = calculateSwapExecution(
        collateralValueToBuy,
        true,
        true,
        fromScale(pool.collateralIld, collateral.scale),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, collateral.scale),
        fromScale(pool.liquidityTradingFeeBps, 4),
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(oracle.price, oracle.expo),
        collateral
      );
      // Buy via specified onasset for output
      let buyIx = cloneClient.swapInstruction(
        poolIndex,
        toScale(collateralValueToBuy, collateral.scale),
        true,
        true,
        toCloneScale(executionEst.result * 0.995),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx, buyIx)
      );

      // Change pool parameters to allow unhealthy comet position
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "IlHealthScoreCoefficient",
          value: 10000,
        },
      });
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "PositionHealthScoreCoefficient",
          value: 10000,
        },
      });

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );
      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      const startingOnassetBalance = fromCloneScale(
        onassetTokenAccountInfo.amount
      );

      let userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      pools = await cloneClient.getPools();
      pool = pools.pools[poolIndex];
      const startingPoolLiquidity = fromScale(
        pool.committedCollateralLiquidity,
        COLLATERAL_SCALE
      );

      let startingHealthScore = getHealthScore(
        oracles,
        pools,
        comet,
        collateral
      );

      let liquidationIx = cloneClient.liquidateCometOnassetILDInstruction(
        pools,
        userAccount,
        cloneClient.provider.publicKey!,
        0,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        toScale(collateralValueToBuy, collateral.scale)
      );
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(liquidationIx)
      );

      userAccount = await cloneClient.getUserAccount();
      comet = userAccount.comet;
      pools = await cloneClient.getPools();
      pool = pools.pools[poolIndex];

      assert.equal(
        Number(comet.positions[0].committedCollateralLiquidity),
        0,
        "committed liquidity should all be withdrawn"
      );
      assert.isBelow(
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        startingPoolLiquidity,
        "pool committed liquidity should be reduced "
      );

      let healthScore = getHealthScore(oracles, pools, comet, collateral);
      assert.isAbove(
        healthScore.healthScore,
        startingHealthScore.healthScore,
        "check health score"
      );
      assert.equal(healthScore.ildHealthImpact, 0, "check ild health impact.");

      onassetTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        pool.assetInfo.onassetMint
      );

      assert.isAbove(
        startingOnassetBalance,
        fromCloneScale(onassetTokenAccountInfo.amount),
        "Onasset should be reduced"
      );

      // Change pool parameters back to original
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "IlHealthScoreCoefficient",
          value: ilHealthScoreCoefficient,
        },
      });
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "PositionHealthScoreCoefficient",
          value: healthScoreCoefficient,
        },
      });

      // Reinitialize liquidity + sell onasset
      const liquidityToAdd = 1_000_000;
      let addLiquidityIx = cloneClient.addLiquidityToCometInstruction(
        toCloneScale(liquidityToAdd),
        0
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(addLiquidityIx)
      );

      pools = await cloneClient.getPools();
      pool = pools.pools[poolIndex];
      let collateralValueToSell = 2000;
      // Test with user CLN stake tier 0.
      executionEst = calculateSwapExecution(
        collateralValueToSell,
        false,
        true,
        fromScale(pool.collateralIld, COLLATERAL_SCALE),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        fromScale(pool.liquidityTradingFeeBps, 4),
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(oracle.price, oracle.expo),
        collateral
      );
      // Sell specifying input (onAsset)
      let sellIx = cloneClient.swapInstruction(
        poolIndex,
        toScale(collateralValueToSell, COLLATERAL_SCALE),
        false,
        true,
        toCloneScale(executionEst.result * 1.005),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address
      );
      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx, sellIx)
      );
    });

    it("pool frozen", async function () {
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      let poolIndex = 0;
      let pool = pools.pools[poolIndex];
      let oracle = oracles.oracles[Number(pool.assetInfo.oracleInfoIndex)];

      // change status to frozen
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "Status",
          value: Status.Frozen,
        },
      });

      pools = await cloneClient.getPools();
      assert.equal(
        pools.pools[poolIndex].status,
        Status.Frozen,
        "pool not frozen"
      );

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);

      collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        cloneClient.clone.collateral.mint
      );

      const treasuryOnassetAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          pool.assetInfo.onassetMint,
          treasuryAddress.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      const treasuryCollateralAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          cloneClient.clone.collateral.mint,
          treasuryAddress.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

      treasuryOnassetTokenAccount = await getAccount(
        cloneClient.provider.connection,
        treasuryOnassetAssociatedTokenAddress,
        "recent"
      );
      treasuryCollateralTokenAccount = await getAccount(
        cloneClient.provider.connection,
        treasuryCollateralAssociatedTokenAddress,
        "recent"
      );

      const amountToBuy = 10;
      let executionEst = calculateSwapExecution(
        amountToBuy,
        false,
        false,
        fromScale(pool.collateralIld, COLLATERAL_SCALE),
        fromCloneScale(pool.onassetIld),
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        fromScale(pool.liquidityTradingFeeBps, 4),
        fromScale(pool.treasuryTradingFeeBps, 4),
        fromScale(oracle.price, oracle.expo),
        cloneClient.clone.collateral
      );
      // Buy via specified onasset for output
      let buyIx = cloneClient.swapInstruction(
        poolIndex,
        toCloneScale(amountToBuy),
        false,
        false,
        toCloneScale(executionEst.result * 1.005),
        pool.assetInfo.onassetMint,
        collateralTokenAccountInfo.address,
        onassetTokenAccountInfo.address,
        treasuryCollateralTokenAccount.address,
        treasuryOnassetTokenAccount.address
      );

      let errorOccured = false;
      try {
        await provider.sendAndConfirm(
          new Transaction().add(updatePricesIx).add(buyIx)
        );
      } catch (error) {
        errorOccured = true;
      }
      assert.equal(errorOccured, true);
    });

    it("comet liquidated due to Liquidation status!", async function () {
      let pools = await cloneClient.getPools();
      let oracles = await cloneClient.getOracles();
      let poolIndex = 0;
      let pool = pools.pools[poolIndex];
      let userAccount = await cloneClient.getUserAccount();
      const startingPoolLiquidity = fromScale(
        pool.committedCollateralLiquidity,
        COLLATERAL_SCALE
      );

      // change status to liquidation
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "Status",
          value: Status.Liquidation,
        },
      });

      let collateral = cloneClient.clone.collateral;
      let collateralTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        cloneClient.provider,
        collateral.mint
      );

      let updatePricesIx = cloneClient.updatePricesInstruction(oracles);
      let liquidationIx = cloneClient.liquidateCometCollateralILDInstruction(
        cloneClient.provider.publicKey!,
        0,
        collateralTokenAccountInfo.address
      );

      await provider.sendAndConfirm(
        new Transaction().add(updatePricesIx).add(liquidationIx)
      );
      pools = await cloneClient.getPools();
      pool = pools.pools[poolIndex];
      userAccount = await cloneClient.getUserAccount();
      let comet = userAccount.comet;
      let healthScore = getHealthScore(oracles, pools, comet, collateral);

      assert.closeTo(healthScore.healthScore, 100, 1, "check health score.");

      assert.isBelow(
        fromScale(pool.committedCollateralLiquidity, COLLATERAL_SCALE),
        startingPoolLiquidity,
        "pool committed liquidity should be reduced "
      );

      // change status to active
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "Status",
          value: Status.Active,
        },
      });
    });

    it("remove pool", async function () {
      let poolIndex = 0;
      let pools = await cloneClient.getPools();
      let underlyingAssetTokenAddress =
        pools.pools[poolIndex].underlyingAssetTokenAccount;
      let underlyingAssetTokenAccount = await getAccount(
        provider.connection,
        underlyingAssetTokenAddress
      );
      let treasuryUnderlyingAssociatedTokenAddress =
        await getAssociatedTokenAddress(
          underlyingAssetTokenAccount.mint,
          cloneClient.clone.treasuryAddress
        );

      // change status to active
      await cloneClient.updatePoolParameters({
        index: poolIndex,
        params: {
          __kind: "Status",
          value: Status.Deprecation,
        },
      });

      let createTreasuryIx = await createAssociatedTokenAccountInstruction(
        this.provider.publicKey!,
        treasuryUnderlyingAssociatedTokenAddress,
        cloneClient.clone.treasuryAddress,
        underlyingAssetTokenAccount.mint
      );
      let closePoolIx = createRemovePoolInstruction(
        {
          admin: cloneClient.provider.publicKey!,
          clone: cloneAccountAddress,
          pools: cloneClient.poolsAddress,
          underlyingAssetMint: underlyingAssetTokenAccount.mint,
          underlyingAssetTokenAccount: underlyingAssetTokenAddress,
          treasuryAssetTokenAccount: treasuryUnderlyingAssociatedTokenAddress,
        } as RemovePoolInstructionAccounts,
        {
          poolIndex,
        } as RemovePoolInstructionArgs
      );

      let tx = new Transaction().add(createTreasuryIx, closePoolIx);

      await provider.sendAndConfirm(tx);

      let updatedPools = await cloneClient.getPools();

      assert.equal(
        pools.pools.length - 1,
        updatedPools.pools.length,
        "check pool length"
      );

      underlyingAssetTokenAccount = await getAccount(
        provider.connection,
        underlyingAssetTokenAddress
      );

      assert.equal(
        Number(underlyingAssetTokenAccount.amount),
        0,
        "check underlying asset token account balance"
      );

      let treasuryUnderlyingAssociatedTokenAccount = await getAccount(
        provider.connection,
        treasuryUnderlyingAssociatedTokenAddress
      );

      assert.isAbove(
        Number(treasuryUnderlyingAssociatedTokenAccount.amount),
        0,
        "check treasury underlying asset token account balance"
      );
    });
});
