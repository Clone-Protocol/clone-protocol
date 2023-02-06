use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, pool_index: u8, health_score_coefficient: u64)]
pub struct UpdatePoolHealthScore<'info> {
    #[account(address = manager.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(
    ctx: Context<UpdatePoolHealthScore>,
    _manager_nonce: u8,
    pool_index: u8,
    health_score_coefficient: u64,
) -> Result<()> {
    // ensure that a valid coefficient was entered
    return_error_if_false!(
        health_score_coefficient > 0,
        InceptError::InvalidHealthScoreCoefficient
    );
    // update coefficient
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    token_data.pools[pool_index as usize]
        .asset_info
        .health_score_coefficient = RawDecimal::new(
        health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
