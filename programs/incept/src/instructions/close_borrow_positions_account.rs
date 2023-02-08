use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
pub struct CloseBorrowPositionsAccount<'info> {
    #[account(address = borrow_positions.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        address = user_account.borrow_positions
    )]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseBorrowPositionsAccount>) -> Result<()> {
    let borrow_positions = ctx.accounts.borrow_positions.load()?;
    return_error_if_false!(
        borrow_positions.num_positions == 0,
        InceptError::RequireAllPositionsClosed
    );
    drop(borrow_positions);

    ctx.accounts
        .borrow_positions
        .close(ctx.accounts.destination.to_account_info())?;
    ctx.accounts.user_account.borrow_positions = Pubkey::default();

    Ok(())
}
