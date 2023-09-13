use crate::events::*;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8, amount: u64)]
pub struct AddCollateralToBorrow<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        address = clone.collateral.vault
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<AddCollateralToBorrow>, borrow_index: u8, amount: u64) -> Result<()> {
    let borrows = &mut ctx.accounts.user_account.borrows;

    // add collateral amount to mint data
    //borrows[borrow_index as usize].collateral_amount += amount;
    borrows[borrow_index as usize].collateral_amount = borrows[borrow_index as usize]
        .collateral_amount
        .checked_add(amount)
        .unwrap();

    // send collateral to vault
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

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrows[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: false,
        collateral_supplied: borrows[borrow_index as usize].collateral_amount,
        collateral_delta: amount.try_into().unwrap(),
        borrowed_amount: borrows[borrow_index as usize].borrowed_onasset,
        borrowed_delta: 0
    });
    ctx.accounts.clone.event_counter = ctx.accounts.clone.event_counter.checked_add(1).unwrap();

    Ok(())
}
