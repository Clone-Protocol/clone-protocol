use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

use crate::instructions::UpdatePoolHealthScore;

pub fn execute(
    ctx: Context<UpdatePoolHealthScore>,
    _manager_nonce: u8,
    pool_index: u8,
    health_score_coefficient: u64,
) -> ProgramResult {
    // ensure that a valid coefficient was entered
    require!(
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
