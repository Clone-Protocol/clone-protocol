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
pub struct WithdrawCollateralFromBorrow<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (borrow_index as usize) < user_account.borrows.len() @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = pools.pools[user_account.borrows[borrow_index as usize].pool_index as usize].status != Status::Frozen @ CloneError::StatusPreventsAction
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
    #[account(
        mut,
        address = clone.collateral.vault,
        constraint = vault.amount >= amount @ CloneError::InvalidTokenAccountBalance
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = clone.collateral.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawCollateralFromBorrow>,
    borrow_index: u8,
    amount: u64,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;
    let borrows = &mut ctx.accounts.user_account.borrows;

    let pool_index = borrows[borrow_index as usize].pool_index;
    let pool = &pools.pools[pool_index as usize];
    let pool_oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_oracle = &oracles.oracles[collateral.oracle_info_index as usize];

    let min_overcollateral_ratio = to_ratio_decimal!(pool.asset_info.min_overcollateral_ratio);
    let collateralization_ratio = to_ratio_decimal!(collateral.collateralization_ratio);
    let borrow_position = &mut borrows[borrow_index as usize];
    let asset_amount_borrowed = to_clone_decimal!(borrow_position.borrowed_onasset);
    let amount_to_withdraw = amount.min(borrow_position.collateral_amount);

    // subtract collateral amount from mint data
    borrow_position.collateral_amount = borrow_position
        .collateral_amount
        .checked_sub(amount_to_withdraw)
        .unwrap();

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool_oracle,
        collateral_oracle,
        asset_amount_borrowed,
        min_overcollateral_ratio,
        collateralization_ratio,
        collateral.to_collateral_decimal(borrow_position.collateral_amount)?,
    )?;

    // send collateral back to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        amount_to_withdraw,
    )?;

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: pool_index.try_into().unwrap(),
        is_liquidation: false,
        collateral_supplied: borrow_position.collateral_amount,
        collateral_delta: -(amount_to_withdraw as i64),
        borrowed_amount: borrow_position.borrowed_onasset,
        borrowed_delta: 0
    });
    ctx.accounts.clone.event_counter = ctx.accounts.clone.event_counter.checked_add(1).unwrap();

    // check to see if mint is empty, if so remove
    if borrow_position.is_empty() {
        borrows.remove(borrow_index as usize);
    }

    Ok(())
}
