#![cfg(feature = "test-bpf")]

use {
    clone::instructions::*,
    solana_program::{
        account_info::AccountInfo,
        system_program,
        sysvar, //
    },
    solana_sdk::{
        account::Account,
        instruction::{AccountMeta, Instruction},
        program::*,
        pubkey::Pubkey,
        signature::{Keypair, Signer},
        sysvar::{clock, rent},
        transaction::Transaction,
    },
};

use anchor_lang::{InstructionData, ToAccountMetas};
use solana_program_test::*;

use spl_token::{instruction::TokenInstruction, state::Account as TokenAccount};

#[cfg(test)]
mod tests {

    use std::println;

    use super::*;
    #[tokio::test]
    async fn poc_prog() {
        let mut program = ProgramTest::default();
        program.add_program("clone", clone::id(), None);

        // Accounts

        let admin = Keypair::new();
        let manager = Keypair::new();
        let user = Keypair::new();

        let collateral_mint = Pubkey::new_unique();
        let cln_token_mint = Pubkey::new_unique();

        let collateral_vault = Pubkey::new_unique();
        let cln_token_vault = Pubkey::new_unique();

        //PDAs

        let (clone_acc, clone_acc_nonce) = Pubkey::find_program_address(&[b"clone"], &clone::id());

        let (pools, pools_nonce) = Pubkey::find_program_address(&[b"pools"], &clone::id());
        let (oracles, oracles_nonce) = Pubkey::find_program_address(&[b"oracles"], &clone::id());

        let (user_account, _user_nonce) =
            Pubkey::find_program_address(&[b"user", &user.pubkey().as_ref()], &clone::id());
        // let (clone_staking_acc, clone_staking_acc_nonce) =  Pubkey::find_program_address(&[b"clone-staking"], &clone_staking::id());

        program.add_account(
            user.pubkey(),
            Account {
                lamports: 1_000_000_000_000,
                data: vec![],
                executable: false,
                owner: system_program::id(),
                ..Account::default()
            },
        );

        let mut local_context = program.start_with_context().await;
        let mut local_env = local_context.banks_client.clone();

        /*
        INITIALIZE USER
         */
        let mut ix = Instruction::new_with_bytes(
            clone::id(),
            clone::instruction::InitializeUser {
                authority: user.pubkey(),
            }
            .data()
            .as_ref(),
            clone::accounts::InitializeUser {
                payer: user.pubkey(),
                user_account: user_account,
                system_program: system_program::id(),
            }
            .to_account_metas(Some(false)),
        );
        println!("SYSEM PROGRAM: {:?}", system_program::id());

        println!("[+] InitializeUser Instruction --->  {:?}", ix);

        let latest_blockhash = local_env.get_latest_blockhash().await.unwrap();
        let mut signers = vec![&user];
        let mut tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&user.pubkey()),
            &signers,
            latest_blockhash,
        );
        println!("TX: {:?}", tx);
        println!("Blockhash: {:?}", latest_blockhash);

        local_env.process_transaction(tx).await.unwrap();
        println!("[+] User Initialized  ");
    }
}
