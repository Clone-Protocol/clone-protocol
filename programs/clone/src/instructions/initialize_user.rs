use crate::states::*;
use anchor_lang::prelude::*;

pub const USER_SEED: &str = "user";

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 10240,
        seeds = [USER_SEED.as_ref(), authority.as_ref()],
        bump,
        payer = payer,
    )]
    pub user_account: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeUser>, _authority: Pubkey) -> Result<()> {
    Ok(())
}
