use std::convert::TryInto;

use crate::error::*;
use crate::events::*;
use crate::states::*;
use crate::{return_error_if_false, CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct AddCollateralToComet<'info> {
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
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        address = clone.collateral.vault,
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

pub fn execute(ctx: Context<AddCollateralToComet>, amount: u64) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);

    let comet = &mut ctx.accounts.user_account.comet;

    // send collateral from user to vault
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
    token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    comet.collateral_amount = comet
        .collateral_amount
        .checked_add(amount)
        .ok_or(error!(CloneError::CheckedMathError))?;

    emit!(CometCollateralUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        collateral_supplied: comet.collateral_amount,
        collateral_delta: amount
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
    });

    ctx.accounts.clone.event_counter = ctx
        .accounts
        .clone
        .event_counter
        .checked_add(1)
        .ok_or(error!(CloneError::CheckedMathError))?;

    Ok(())
}
