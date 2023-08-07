use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::{to_clone_decimal, to_ratio_decimal, CLONE_PROGRAM_SEED, TOKEN_DATA_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, collateral_index: u8, onasset_amount: u64, collateral_amount: u64)]
pub struct InitializeBorrowPosition<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump,
        constraint = token_data.load()?.pools[pool_index as usize].status == Status::Active as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[collateral_index as usize].vault
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_collateral_token_account.amount >= collateral_amount @ CloneError::InvalidTokenAccountBalance,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<InitializeBorrowPosition>,
    pool_index: u8,
    collateral_index: u8,
    onasset_amount: u64,
    collateral_amount: u64,
) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let pool = token_data.pools[pool_index as usize];
    let pool_oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_index = collateral_index as usize;
    let collateral = token_data.collaterals[collateral_index];
    let collateral_scale = collateral.scale;
    let min_overcollateral_ratio = to_ratio_decimal!(pool.asset_info.min_overcollateral_ratio);
    let collateralization_ratio = to_ratio_decimal!(collateral.collateralization_ratio);
    let collateral_oracle = if collateral_index == ONUSD_COLLATERAL_INDEX
        || collateral_index == USDC_COLLATERAL_INDEX
    {
        None
    } else {
        Some(token_data.oracles[collateral.oracle_info_index as usize])
    };

    let collateral_amount_value = Decimal::new(
        collateral_amount.try_into().unwrap(),
        collateral_scale.try_into().unwrap(),
    );
    let onasset_amount_value = to_clone_decimal!(onasset_amount);

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool_oracle,
        collateral_oracle,
        onasset_amount_value,
        min_overcollateral_ratio,
        collateralization_ratio,
        collateral_amount_value,
    )?;

    // lock user collateral in vault
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        to: ctx.accounts.vault.to_account_info().clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();

    token::transfer(
        CpiContext::new(cpi_program, cpi_accounts),
        collateral_amount,
    )?;

    // mint onasset to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        onasset_amount,
    )?;

    // set mint position data
    let user_account = &mut ctx.accounts.user_account.load_mut()?;
    let num_positions = user_account.borrows.num_positions;
    user_account.borrows.positions[num_positions as usize] = BorrowPosition {
        collateral_amount,
        collateral_index: collateral_index.try_into().unwrap(),
        pool_index: pool_index.try_into().unwrap(),
        borrowed_onasset: onasset_amount,
    };

    // increment number of mint positions
    user_account.borrows.num_positions += 1;

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index,
        is_liquidation: false,
        collateral_supplied: collateral_amount,
        collateral_delta: collateral_amount.try_into().unwrap(),
        collateral_index: collateral_index.try_into().unwrap(),
        borrowed_amount: onasset_amount,
        borrowed_delta: onasset_amount.try_into().unwrap()
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
