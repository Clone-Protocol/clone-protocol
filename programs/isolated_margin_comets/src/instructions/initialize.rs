use crate::states::*;
use anchor_lang::prelude::*;

pub const MANAGER_SEED: &str = "manager";

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializePositionManager<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 32, // 8 + 4 + 1 * 20
        seeds = [MANAGER_SEED.as_ref(), authority.as_ref()],
        bump,
        payer = payer,
    )]
    pub manager_account: Account<'info, PositionManager>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializePositionManager>, _authority: Pubkey) -> Result<()> {
    Ok(())
}
