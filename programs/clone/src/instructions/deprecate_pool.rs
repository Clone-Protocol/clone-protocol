use crate::error::CloneError;
use crate::states::*;
use anchor_lang::prelude::*;
use crate::CLONE_PROGRAM_SEED;


#[derive(Accounts)]
#[instruction(pool_index: u8)]
pub struct DeprecatePool<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.num_pools > (pool_index as u64) @ CloneError::InvalidInputPositionIndex
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<DeprecatePool>, pool_index: u8) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool_index = pool_index as usize;

    token_data.pools[pool_index].deprecated = 1;

    Ok(())
}
