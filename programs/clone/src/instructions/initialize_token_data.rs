use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

pub const TOKEN_DATA_SEED: &str = "token-data";

#[derive(Accounts)]
pub struct InitializeTokenData<'info> {
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
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump,
        payer = admin,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeTokenData>) -> Result<()> {
    Ok(())
}
