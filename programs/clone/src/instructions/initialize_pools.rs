use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

pub const POOLS_SEED: &str = "pools";

#[derive(Accounts)]
pub struct InitializePools<'info> {
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
        seeds = [POOLS_SEED.as_ref()],
        bump,
        payer = admin,
    )]
    pub pools: Account<'info, Pools>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializePools>) -> Result<()> {
    Ok(())
}
