use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, TOKEN_DATA_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(len: u16)]
pub struct ReallocateTokenData<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
        has_one = admin,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        realloc = len as usize,
        realloc::zero = true,
        realloc::payer = admin,
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<ReallocateTokenData>, _len: u16) -> Result<()> {
    Ok(())
}
