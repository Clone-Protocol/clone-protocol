use crate::error::InceptError;
use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(pool_index: u8)]
pub struct DeprecatePool<'info> {
    #[account(address = incept.admin)]
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
 
    token_data.pools[pool_index].deprecated = 1;

    Ok(())
}
