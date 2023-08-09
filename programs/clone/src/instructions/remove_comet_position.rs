use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct RemoveCometPosition<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = user_account.comet.positions.len() > comet_position_index.into() @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
    )]
    pub pools: Box<Account<'info, Pools>>,
}

pub fn execute(ctx: Context<RemoveCometPosition>, comet_position_index: u8) -> Result<()> {
    let comet = &mut ctx.accounts.user_account.comet;
    let comet_position = comet.positions[comet_position_index as usize];

    return_error_if_false!(
        comet_position.committed_collateral_liquidity == 0
            && comet_position.onasset_ild_rebate == 0
            && comet_position.collateral_ild_rebate == 0,
        CloneError::CometNotEmpty
    );

    comet.positions.remove(comet_position_index.into());

    Ok(())
}
