use crate::error::*;
use crate::instructions::UpdateILHealthScoreCoefficient;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

pub fn execute(
    ctx: Context<UpdateILHealthScoreCoefficient>,
    _manager_nonce: u8,
    _il_health_score_coefficient: u64,
) -> ProgramResult {
    // ensure that a valid coefficient was entered
    require!(
        _il_health_score_coefficient > 0,
        InceptError::InvalidHealthScoreCoefficient
    );

    // update coefficient
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    token_data.il_health_score_coefficient = RawDecimal::new(
        _il_health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
