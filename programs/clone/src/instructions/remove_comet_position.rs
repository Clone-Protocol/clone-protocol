use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct RemoveCometPosition<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = user_account.comet.num_positions > comet_position_index.into() @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<RemoveCometPosition>, comet_position_index: u8) -> Result<()> {
    let comet = &mut ctx.accounts.user_account.comet;
    let comet_position = comet.positions[comet_position_index as usize];

    return_error_if_false!(
        comet_position
            .committed_onusd_liquidity
            .to_decimal()
            .is_zero()
            && comet_position.onasset_ild_rebate.to_decimal().is_zero()
            && comet_position.onusd_ild_rebate.to_decimal().is_zero(),
        CloneError::CometNotEmpty
    );

    comet.remove_position(comet_position_index.into());

    Ok(())
}
