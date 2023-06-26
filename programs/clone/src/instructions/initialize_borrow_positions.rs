//use crate::instructions::InitializeBorrowPositions;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
pub struct InitializeBorrowPositions<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeBorrowPositions>) -> Result<()> {
    let mut borrow_positions = ctx.accounts.borrow_positions.load_init()?;

    // set user data
    ctx.accounts.user_account.borrow_positions =
        *ctx.accounts.borrow_positions.to_account_info().key;

    // set user as owner
    borrow_positions.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
