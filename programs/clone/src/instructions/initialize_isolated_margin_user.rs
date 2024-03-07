use crate::initialize_user::USER_SEED;
use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeIsolatedMarginUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 8 + 48,
        seeds = [USER_SEED.as_ref(), authority.as_ref()],
        bump,
        payer = payer,
    )]
    pub user_account: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeIsolatedMarginUser>, _authority: Pubkey) -> Result<()> {
    Ok(())
}
