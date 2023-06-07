use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
pub struct CloseUserAccount<'info> {
    #[account(address = user_account.authority)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseUserAccount>) -> Result<()> {
    // remove single pool comet
    let user_account = ctx.accounts.user_account.clone();
    assert!(
        user_account.comet == Pubkey::default()
            && user_account.single_pool_comets == Pubkey::default()
            && user_account.borrow_positions == Pubkey::default()
    );

    ctx.accounts
        .user_account
        .close(ctx.accounts.destination.to_account_info())?;

    Ok(())
}