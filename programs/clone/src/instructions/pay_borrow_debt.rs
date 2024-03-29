use crate::error::*;
use crate::events::*;
use crate::states::*;
use crate::{return_error_if_false, CLONE_PROGRAM_SEED, POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, borrow_index: u8, amount: u64)]
pub struct PayBorrowDebt<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump,
        constraint = (borrow_index as usize) < user_account.borrows.len() @ CloneError::InvalidInputPositionIndex,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = pools.pools[user_account.borrows[borrow_index as usize].pool_index as usize].status != Status::Frozen @ CloneError::StatusPreventsAction
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        constraint = payer_onasset_token_account.amount >= amount @ CloneError::InvalidTokenAccountBalance,
        associated_token::mint = onasset_mint,
        associated_token::authority = payer
    )]
    pub payer_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = pools.pools[user_account.borrows[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<PayBorrowDebt>,
    user: Pubkey,
    borrow_index: u8,
    amount: u64,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let borrows = &mut ctx.accounts.user_account.borrows;
    let borrow_position = borrows[borrow_index as usize];
    let amount_value = amount.min(borrow_position.borrowed_onasset);

    // burn user onasset to pay back mint position
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .payer_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.payer.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(CpiContext::new(cpi_program, cpi_accounts), amount_value)?;

    // update total amount of borrowed onasset
    borrows[borrow_index as usize].borrowed_onasset = borrows[borrow_index as usize]
        .borrowed_onasset
        .checked_sub(amount_value)
        .ok_or(error!(CloneError::CheckedMathError))?;

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: user,
        pool_index: borrows[borrow_index as usize]
            .pool_index
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
        is_liquidation: false,
        collateral_supplied: borrows[borrow_index as usize].collateral_amount,
        collateral_delta: 0,
        borrowed_amount: borrows[borrow_index as usize].borrowed_onasset,
        borrowed_delta: -(amount_value
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?)
    });
    ctx.accounts.clone.event_counter = ctx
        .accounts
        .clone
        .event_counter
        .checked_add(1)
        .ok_or(error!(CloneError::CheckedMathError))?;

    Ok(())
}
