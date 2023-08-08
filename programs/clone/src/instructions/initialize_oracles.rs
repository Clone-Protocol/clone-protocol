use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

pub const ORACLES_SEED: &str = "pools";

#[derive(Accounts)]
pub struct InitializeOracles<'info> {
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
        seeds = [ORACLES_SEED.as_ref()],
        bump,
        payer = admin,
    )]
    pub oracles: Account<'info, Oracles>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeOracles>) -> Result<()> {
    Ok(())
}
