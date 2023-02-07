use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( il_health_score_coefficient: u64)]
pub struct UpdateILHealthScoreCoefficient<'info> {
    #[account(address = manager.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager.bump,
        has_one = token_data
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(
    ctx: Context<UpdateILHealthScoreCoefficient>,

    _il_health_score_coefficient: u64,
) -> Result<()> {
    // ensure that a valid coefficient was entered
    return_error_if_false!(
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
