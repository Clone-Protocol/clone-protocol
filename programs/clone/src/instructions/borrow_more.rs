use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{
    to_clone_decimal, to_ratio_decimal, CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8, amount: u64)]
pub struct BorrowMore<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        seeds = [POOLS_SEED.as_ref()],
        bump
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = pools.pools[user_account.borrows[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<BorrowMore>, borrow_index: u8, amount: u64) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];

    let collateral = &ctx.accounts.clone.collateral;
    let pools = &ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;
    let borrows = &mut ctx.accounts.user_account.borrows;

    let pool_index = borrows[borrow_index as usize].pool_index;
    let pool = &pools.pools[pool_index as usize];
    return_error_if_false!(
        pool.status == Status::Active,
        CloneError::StatusPreventsAction
    );

    let pool_oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_oracle = &oracles.oracles[collateral.oracle_info_index as usize];
    let borrow_position = borrows[borrow_index as usize];
    let min_overcollateral_ratio = to_ratio_decimal!(pool.asset_info.min_overcollateral_ratio);
    let collateralization_ratio = to_ratio_decimal!(collateral.collateralization_ratio);

    borrows[borrow_index as usize].borrowed_onasset = borrows[borrow_index as usize]
        .borrowed_onasset
        .checked_add(amount)
        .unwrap();

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool_oracle,
        collateral_oracle,
        to_clone_decimal!(borrows[borrow_index as usize].borrowed_onasset),
        min_overcollateral_ratio,
        collateralization_ratio,
        collateral.to_collateral_decimal(borrow_position.collateral_amount)?,
    )?;

    // mint onasset to the user
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
        amount,
    )?;

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: pool_index.try_into().unwrap(),
        is_liquidation: false,
        collateral_supplied: borrows[borrow_index as usize].collateral_amount,
        collateral_delta: 0,
        borrowed_amount: borrows[borrow_index as usize].borrowed_onasset,
        borrowed_delta: amount.try_into().unwrap()
    });
    ctx.accounts.clone.event_counter = ctx.accounts.clone.event_counter.checked_add(1).unwrap();

    Ok(())
}
