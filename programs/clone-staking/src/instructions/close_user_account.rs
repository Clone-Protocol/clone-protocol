use crate::error::CloneStakingError;
use crate::states::*;
use crate::USER_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseUserAccount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump = user_account.bump,
        close = user
    )]
    pub user_account: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseUserAccount>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;

    require!(
        user_account.is_empty(),
        CloneStakingError::UserAccountNotEmpty
    );

    user_account.close(ctx.accounts.user.to_account_info().clone())?;

    Ok(())
}
