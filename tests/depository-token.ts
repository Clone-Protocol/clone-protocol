import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  mintTo,
  createMintToInstruction,
} from "@solana/spl-token";
import * as depository_token from "../sdk/generated/depository-token";
import { assert } from "console";

export const depositoryTokenTests = async () => {
  describe("depository-token contract tests", async () => {
    // Setup
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);
    let walletPubkey = provider.publicKey!;
    let programId = anchor.workspace.DepositoryToken.programId;
    const ratio = 1_000_000;
    const [settingsAccountAddress, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("settings")],
      programId
    );
    // Create instruction to initialize the depositing and depository mint token accounts
    const depositingTokenMintKeypair = Keypair.generate();
    const depositingTokenAccountAddress = await getAssociatedTokenAddress(
      depositingTokenMintKeypair.publicKey,
      walletPubkey
    );
    const depositingTokenAccountAddressSettings =
      await getAssociatedTokenAddress(
        depositingTokenMintKeypair.publicKey,
        settingsAccountAddress,
        true
      );

    const depositoryTokenMintKeypair = Keypair.generate();
    const depositoryTokenAccountAddress = await getAssociatedTokenAddress(
      depositoryTokenMintKeypair.publicKey,
      walletPubkey
    );

    it("initialize mint and token accounts", async () => {
      const space = MINT_SIZE;
      const lamports = await getMinimumBalanceForRentExemptMint(
        provider.connection
      );
      await provider.sendAndConfirm(
        new Transaction().add(
          SystemProgram.createAccount({
            fromPubkey: provider.publicKey!,
            newAccountPubkey: depositingTokenMintKeypair.publicKey,
            space,
            lamports,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMintInstruction(
            depositingTokenMintKeypair.publicKey,
            0,
            walletPubkey,
            walletPubkey
          ),
          SystemProgram.createAccount({
            fromPubkey: provider.publicKey!,
            newAccountPubkey: depositoryTokenMintKeypair.publicKey,
            space,
            lamports,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMintInstruction(
            depositoryTokenMintKeypair.publicKey,
            8,
            settingsAccountAddress,
            settingsAccountAddress
          )
        ),
        [depositingTokenMintKeypair, depositoryTokenMintKeypair]
      );

      await provider.sendAndConfirm(
        new Transaction().add(
          createAssociatedTokenAccountInstruction(
            walletPubkey,
            depositingTokenAccountAddress,
            walletPubkey,
            depositingTokenMintKeypair.publicKey
          ),
          createAssociatedTokenAccountInstruction(
            walletPubkey,
            depositingTokenAccountAddressSettings,
            settingsAccountAddress,
            depositingTokenMintKeypair.publicKey
          ),
          createAssociatedTokenAccountInstruction(
            walletPubkey,
            depositoryTokenAccountAddress,
            walletPubkey,
            depositoryTokenMintKeypair.publicKey
          )
        )
      );
    });

    it("Initializes the program", async () => {
      const tx = new Transaction().add(
        depository_token.createInitializeInstruction(
          {
            payer: walletPubkey,
            settings: settingsAccountAddress,
            depositoryTokenMint: depositoryTokenMintKeypair.publicKey,
            depositingTokenAccount: depositingTokenAccountAddressSettings,
          },
          {
            ratio,
            depositingTokenMint: depositingTokenMintKeypair.publicKey,
          }
        )
      );
      await provider.sendAndConfirm(tx);
    });

    it(`10 roundtrip mint and redeem tokens`, async () => {
      const min = 10_000_000;
      const max = 1_000_000_000;
      const startingDepositingTokenBalance = max * ratio;
      // Mint depositing tokens to use.
      const getRandomTokenAmount = () => {
        return Math.floor(Math.random() * (max - min) + min);
      };

      await provider.sendAndConfirm(
        new Transaction().add(
          createMintToInstruction(
            depositingTokenMintKeypair.publicKey,
            depositingTokenAccountAddress,
            walletPubkey,
            startingDepositingTokenBalance
          )
        )
      );
      const roundtrips = 10;
      for (let i = 0; i < roundtrips; i++) {
        const amount = getRandomTokenAmount();
        // Mint depository tokens via contract
        await provider.sendAndConfirm(
          new Transaction().add(
            depository_token.createMintDepositoryTokenInstruction(
              {
                user: walletPubkey,
                settings: settingsAccountAddress,
                depositoryTokenMint: depositoryTokenMintKeypair.publicKey,
                depositingTokenAccount: depositingTokenAccountAddressSettings,
                userDepositingTokenAccount: depositingTokenAccountAddress,
                userDepositoryTokenAccount: depositoryTokenAccountAddress,
              },
              {
                mintAmount: new anchor.BN(amount),
              }
            )
          )
        );

        // Check depository token balance and depositing token balance
        let depositoryTokenBalance =
          await provider.connection.getTokenAccountBalance(
            depositoryTokenAccountAddress
          );
        let depositingTokenBalance =
          await provider.connection.getTokenAccountBalance(
            depositingTokenAccountAddress
          );
        assert(amount === Number(depositoryTokenBalance.value.amount));
        assert(
          startingDepositingTokenBalance - amount * ratio ===
            Number(depositingTokenBalance.value.amount)
        );
        // Redeem depositing tokens
        await provider.sendAndConfirm(
          new Transaction().add(
            depository_token.createRedeemDepositoryTokenInstruction(
              {
                user: walletPubkey,
                settings: settingsAccountAddress,
                depositoryTokenMint: depositoryTokenMintKeypair.publicKey,
                depositingTokenAccount: depositingTokenAccountAddressSettings,
                userDepositingTokenAccount: depositingTokenAccountAddress,
                userDepositoryTokenAccount: depositoryTokenAccountAddress,
              },
              {
                redeemAmount: amount,
              }
            )
          )
        );

        depositoryTokenBalance =
          await provider.connection.getTokenAccountBalance(
            depositoryTokenAccountAddress
          );
        depositingTokenBalance =
          await provider.connection.getTokenAccountBalance(
            depositingTokenAccountAddress
          );
        assert(0 === Number(depositoryTokenBalance.value.amount));
        assert(
          startingDepositingTokenBalance ===
            Number(depositingTokenBalance.value.amount)
        );
      }
    });
  });
};
