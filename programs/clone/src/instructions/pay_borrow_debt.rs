use crate::error::*;
use crate::events::*;
use crate::states::*;
use crate::{to_clone_decimal, CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8, amount: u64)]
pub struct PayBorrowDebt<'info> {
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
        constraint = token_data.load()?.pools[user_account.load()?.borrows.positions[borrow_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = user_onasset_token_account.amount >= amount @ CloneError::InvalidTokenAccountBalance,
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

pub fn execute(ctx: Context<PayBorrowDebt>, borrow_index: u8, amount: u64) -> Result<()> {
    let mut amount_value = Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE);

    let mut token_data = ctx.accounts.token_data.load_mut()?;

    let borrows = &mut ctx.accounts.user_account.load_mut()?.borrows;
    let borrow_position = borrows.positions[borrow_index as usize];

    amount_value = amount_value.min(to_clone_decimal!(borrow_position.borrowed_onasset));

    // burn user onasset to pay back mint position
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        amount_value.mantissa().try_into().unwrap(),
    )?;

    // update total amount of borrowed onasset
    borrows.positions[borrow_index as usize].borrowed_onasset -= amount_value.mantissa() as u64;
    token_data.pools[borrow_position.pool_index as usize]
        .asset_info
        .total_borrowed_amount -= amount_value.mantissa() as u64;

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
        borrowed_delta: -amount_value.mantissa() as i64
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
