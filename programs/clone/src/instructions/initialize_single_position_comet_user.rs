use crate::states::*;
use crate::initialize_user::USER_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeSinglePositionCometUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 56 + 32,
        seeds = [USER_SEED.as_ref(), authority.as_ref()],
        bump,
        payer = payer,
    )]
    pub user_account: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeSinglePositionCometUser>, _authority: Pubkey) -> Result<()> {
    Ok(())
}
