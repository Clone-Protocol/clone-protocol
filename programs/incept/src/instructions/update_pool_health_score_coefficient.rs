use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( pool_index: u8, health_score_coefficient: u64)]
pub struct UpdatePoolHealthScore<'info> {
    #[account(address = incept.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(
    ctx: Context<UpdatePoolHealthScore>,

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
