use crate::error::CloneStakingError;
use crate::states::*;
use anchor_lang::prelude::*;

pub const USER_SEED: &str = "user";

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 8 + 56,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump,
        payer = payer
    )]
    pub user_account: Account<'info, User>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeUser>, _user: Pubkey) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    user_account.bump = *ctx
        .bumps
        .get("user_account")
        .ok_or(error!(CloneStakingError::BumpNotFound))?;
    Ok(())
}
