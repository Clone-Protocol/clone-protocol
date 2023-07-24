use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use crate::USER_SEED;


#[derive(Accounts)]
pub struct CloseUserAccount<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseUserAccount>) -> Result<()> {
    // remove single pool comet
    let user_account = ctx.accounts.user_account.clone();
    assert!(
        user_account.comet.is_empty()
            && user_account.borrows.is_empty()
    );

    ctx.accounts
        .user_account
        .close(ctx.accounts.destination.to_account_info())?;

    Ok(())
}
