use crate::error::InceptError;
use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(pool_index: u8, force_removal: bool)]
pub struct DeprecatePool<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept,
        constraint = token_data.load()?.num_pools > (pool_index as u64) @ InceptError::InvalidInputPositionIndex
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<DeprecatePool>, pool_index: u8) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool_index = pool_index as usize;
 
    token_data.pools[pool_index].deprecated = true;

    Ok(())
}
