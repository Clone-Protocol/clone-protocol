/*
    Integration test of the clone interface for jupiter integration.
    The test goes through the initialization, updating and quoting of the clone-interface.
    It also goes through many simulations of swaps to verify the correctness of the
    generated quotes.
*/

use anyhow::{anyhow, Result};
use clone::{decimal::CLONE_TOKEN_SCALE, ID};
use jupiter_amm_interface::{AccountMap, Amm, KeyedAccount, QuoteParams, SwapMode, SwapParams};
use rand::prelude::*;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_program_test::{ProgramTest, ProgramTestContext};
use solana_sdk::{
    account::{Account, AccountSharedData, ReadableAccount},
    bpf_loader_upgradeable,
    commitment_config::CommitmentLevel,
    native_token::LAMPORTS_PER_SOL,
    program_pack::Pack,
    pubkey::Pubkey,
    signature::Signer,
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::state::{Account as TokenAccount, AccountState, Mint};
use std::env;

extern crate jupiter_interface;
use jupiter_interface::*;

async fn create_interface(rpc: &RpcClient) -> Result<CloneInterface> {
    let pools_address = get_pools_account_address();
    let pools_account = rpc.get_account(&pools_address).await?;

    let keyed_account = KeyedAccount {
        key: pools_address,
        account: pools_account,
        params: None,
    };
    let mut clone_interface = CloneInterface::from_keyed_account(&keyed_account)?;

    let mut accounts_map = AccountMap::new();

    // Need to update twice, second time will get the required oracle addresses for quoting
    for _ in 0..2 {
        // Update accounts
        let accounts_to_update = clone_interface.get_accounts_to_update();
        let accounts = rpc.get_multiple_accounts(&accounts_to_update).await?;

        accounts.iter().enumerate().for_each(|(i, account)| {
            if account.is_none() {
                return;
            }
            accounts_map.insert(accounts_to_update[i], account.clone().unwrap());
        });

        clone_interface.update(&accounts_map)?;
    }

    Ok(clone_interface)
}

fn derive_program_data_address(program_id: Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[program_id.as_ref()], &bpf_loader_upgradeable::ID).0
}

fn create_mock_token_account(mint: Pubkey, owner: Pubkey) -> AccountSharedData {
    let token_account = TokenAccount {
        mint,
        owner,
        amount: 0,
        delegate: None.into(),
        state: AccountState::Initialized,
        is_native: None.into(),
        delegated_amount: 0,
        close_authority: None.into(),
    };

    let mut account = AccountSharedData::new(LAMPORTS_PER_SOL, TokenAccount::LEN, &spl_token::ID);
    let mut buffer = [0u8; TokenAccount::LEN];
    token_account.pack_into_slice(&mut buffer);
    account.set_data_from_slice(&buffer);
    account
}

async fn set_mock_token_account(
    context: &mut ProgramTestContext,
    token_account_address: Pubkey,
    amount: u64,
) -> Result<()> {
    // This sets the amount of the token account but also updates the mint account to properly reflect the change
    let account = context
        .banks_client
        .get_account_with_commitment(token_account_address, CommitmentLevel::Confirmed)
        .await?
        .ok_or(anyhow!("Token account should exist"))?;
    let mut token_account_struct = TokenAccount::unpack(account.data())?;
    let current_token_amount = token_account_struct.amount;

    let mint_account = context
        .banks_client
        .get_account_with_commitment(token_account_struct.mint, CommitmentLevel::Confirmed)
        .await?
        .ok_or(anyhow!("Token account should exist"))?;
    let mut mint_account_struct = Mint::unpack(mint_account.data())?;

    if amount == current_token_amount {
        return Ok(());
    }

    token_account_struct.amount = amount;
    let mut buffer = [0u8; TokenAccount::LEN];
    token_account_struct.pack_into_slice(&mut buffer);
    let mut temp = AccountSharedData::try_from(account)?;
    temp.set_data_from_slice(&buffer);
    context.set_account(&token_account_address, &temp);

    mint_account_struct.supply += amount;
    mint_account_struct.supply -= current_token_amount;
    let mut buffer = [0u8; Mint::LEN];
    mint_account_struct.pack_into_slice(&mut buffer);
    let mut temp = AccountSharedData::try_from(mint_account)?;
    temp.set_data_from_slice(&buffer);
    context.set_account(&token_account_struct.mint, &temp);

    Ok(())
}

fn read_balance_from_token_account(account: &Account) -> Result<u64> {
    Ok(TokenAccount::unpack(account.data())?.amount)
}

#[tokio::test]
async fn swap_integration_test() -> Result<()> {
    // Setup Program test Context
    let mut program_test = ProgramTest::default();
    let local_clone_program_loaded = if env::var("BPF_OUT_DIR").is_ok() {
        program_test.add_program(&"clone", ID, None);
        true
    } else {
        false
    };
    let mut context = program_test.start_with_context().await;

    // Setup clone interface
    let rpc = RpcClient::new(
        env::var("SOLANA_ENDPOINT_URL")
            .unwrap_or("https://api.mainnet-beta.solana.com".to_string()),
    );
    let mut clone_interface = create_interface(&rpc).await?;

    // Gather all accounts that need to be loaded in order to perform swaps.
    // Use these accounts as our initial state for the simulation.
    let clone_account = clone_interface
        .clone
        .clone()
        .expect("clone should be loaded");
    let pools = clone_interface.pools.clone();
    let mut account_pubkeys = clone_interface.get_accounts_to_update();
    account_pubkeys.extend(clone_interface.get_reserve_mints());
    // For treasury
    account_pubkeys.extend(
        clone_interface
            .get_reserve_mints()
            .iter()
            .map(|mint| get_associated_token_address(&clone_account.treasury_address, mint))
            .collect::<Vec<Pubkey>>(),
    );
    account_pubkeys.push(clone_account.collateral.vault);

    if !local_clone_program_loaded {
        account_pubkeys.extend(vec![
            clone_interface.program_id(),
            derive_program_data_address(clone_interface.program_id()),
        ]);
    }

    // Pull latest state from RPC, load into CloneInterface and Context.
    let accounts = rpc.get_multiple_accounts(&account_pubkeys).await?;
    let mut accounts_map = AccountMap::new();

    account_pubkeys
        .iter()
        .zip(accounts)
        .for_each(|(pubkey, account)| {
            if let Some(account) = account {
                accounts_map.insert(*pubkey, account.clone());
                let account_shared_data = AccountSharedData::from(account.clone());
                context.set_account(&pubkey, &account_shared_data)
            }
        });

    clone_interface.update(&accounts_map)?;

    let generate_random_quote_params = || {
        let mut rng = rand::thread_rng();
        let input_is_collateral: bool = rng.gen();
        let swap_mode = if rng.gen() {
            SwapMode::ExactIn
        } else {
            SwapMode::ExactOut
        };
        let amount_is_collateral = (input_is_collateral && swap_mode == SwapMode::ExactIn)
            || (!input_is_collateral && swap_mode == SwapMode::ExactOut);
        let scale = if amount_is_collateral {
            clone_account.collateral.scale.try_into().unwrap()
        } else {
            CLONE_TOKEN_SCALE
        };
        let max_amount = 1000 * 10u64.pow(scale);
        // Min is arbitrarily chosen but high enough to always generate fees.
        let min_amount = 100000u64;
        let amount: u64 = rng.gen_range(min_amount..max_amount);
        let classet_mint = pools.pools[rng.gen_range(0..pools.pools.len()) as usize]
            .asset_info
            .onasset_mint;

        let (input_mint, output_mint) = if input_is_collateral {
            (clone_account.collateral.mint, classet_mint)
        } else {
            (classet_mint, clone_account.collateral.mint)
        };

        QuoteParams {
            amount,
            input_mint,
            output_mint,
            swap_mode,
        }
    };

    // Create token accounts for payer:
    for mint_address in clone_interface.get_reserve_mints() {
        let token_account_address =
            get_associated_token_address(&context.payer.pubkey(), &mint_address);
        context.set_account(
            &token_account_address,
            &create_mock_token_account(mint_address, context.payer.pubkey()),
        );
    }

    let number_of_swaps = 128;

    for i in 0..number_of_swaps {
        println!("\nSWAP: {}", i + 1);
        let quote_params = generate_random_quote_params();
        println!("QUOTE PARAMS: {:?}", quote_params);
        let quote = clone_interface.quote(&quote_params)?;
        println!("QUOTE: {:?}", quote);

        let recent_blockhash = context.banks_client.get_latest_blockhash().await?;

        let swap_params = SwapParams {
            in_amount: quote.in_amount,
            out_amount: quote.out_amount,
            source_mint: quote_params.input_mint,
            destination_mint: quote_params.output_mint,
            source_token_account: get_associated_token_address(
                &context.payer.pubkey(),
                &quote_params.input_mint,
            ),
            destination_token_account: get_associated_token_address(
                &context.payer.pubkey(),
                &quote_params.output_mint,
            ),
            token_transfer_authority: context.payer.pubkey().clone(),
            open_order_address: None,
            quote_mint_to_referrer: None,
            jupiter_program_id: &Pubkey::default(), // NOTE: Need to update this.
            missing_dynamic_accounts_as_default: false,
        };

        // Set the exact amount required for this swap.
        set_mock_token_account(
            &mut context,
            swap_params.source_token_account,
            quote.in_amount,
        )
        .await?;
        set_mock_token_account(&mut context, swap_params.destination_token_account, 0).await?;

        let instructions = vec![
            // clone_interface.create_update_prices_instruction(None)?,
            // this creates a swap with 0 slippage, a successful swap
            // means our we quoted perfectly for in/out amounts
            clone_interface.create_swap_instruction(
                &swap_params,
                quote_params.swap_mode,
                0,
                Some(quote),
            )?,
        ];

        let transaction = Transaction::new_signed_with_payer(
            &instructions,
            Some(&context.payer.pubkey()),
            &[&context.payer],
            recent_blockhash,
        );

        context
            .banks_client
            .process_transaction_with_commitment(transaction, CommitmentLevel::Confirmed)
            .await?;

        // Additional check for our account balances
        let source_token_account = context
            .banks_client
            .get_account_with_commitment(
                swap_params.source_token_account,
                CommitmentLevel::Confirmed,
            )
            .await?
            .expect("Source token account should exist");
        assert_eq!(
            read_balance_from_token_account(&source_token_account)?,
            0,
            "input token balance should be 0 after swap"
        );

        let destination_token_account = context
            .banks_client
            .get_account_with_commitment(
                swap_params.destination_token_account,
                CommitmentLevel::Confirmed,
            )
            .await?
            .expect("Destination token account should exist");
        assert_eq!(
            read_balance_from_token_account(&destination_token_account)?,
            quote.out_amount,
            "output token balance should be equal to the quote output after swap"
        );

        // Reload the clone interface w/ new banks client state
        let mut account_map = AccountMap::new();
        for addr in clone_interface.get_accounts_to_update() {
            if let Some(account) = context.banks_client.get_account(addr).await? {
                account_map.insert(addr, account);
            }
        }
        clone_interface.update(&account_map)?;
    }

    Ok(())
}
