use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::to_ratio_decimal;
use crate::{to_clone_decimal, CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( borrow_index: u8, amount: u64)]
pub struct BorrowMore<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (borrow_index as u64) < user_account.load()?.borrows.num_positions @ CloneError::InvalidInputPositionIndex,
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[user_account.load()?.borrows.positions[borrow_index as usize].pool_index as usize].status == Status::Active as u64 @ CloneError::StatusPreventsAction,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = token_data.load()?.pools[user_account.load()?.borrows.positions[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<BorrowMore>, borrow_index: u8, amount: u64) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let borrows = &mut ctx.accounts.user_account.load_mut()?.borrows;

    let pool_index = borrows.positions[borrow_index as usize].pool_index;
    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let borrow_position = borrows.positions[borrow_index as usize];
    let collateral_ratio = to_ratio_decimal!(pool.asset_info.stable_collateral_ratio);

    borrows.positions[borrow_index as usize].borrowed_onasset += amount;
    token_data.pools[pool_index as usize]
        .asset_info
        .total_borrowed_amount += amount;

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        oracle,
        to_clone_decimal!(borrows.positions[borrow_index as usize].borrowed_onasset),
        collateral_ratio,
        to_clone_decimal!(borrow_position.collateral_amount),
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
        pool_index: borrows.positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: false,
        collateral_supplied: borrows.positions[borrow_index as usize]
            .collateral_amount
            .try_into()
            .unwrap(),
        collateral_delta: 0,
        collateral_index: borrows.positions[borrow_index as usize]
            .collateral_index
            .try_into()
            .unwrap(),
        borrowed_amount: borrows.positions[borrow_index as usize]
            .borrowed_onasset
            .try_into()
            .unwrap(),
        borrowed_delta: amount.try_into().unwrap()
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
