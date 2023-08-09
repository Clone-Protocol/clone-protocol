use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

pub const USER_SEED: &str = "user";

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeUser<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
        has_one = admin,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        init,
        space = 10240,
        seeds = [USER_SEED.as_ref(), authority.as_ref()],
        bump,
        payer = admin,
    )]
    pub user_account: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeUser>, _authority: Pubkey) -> Result<()> {
    Ok(())
}
