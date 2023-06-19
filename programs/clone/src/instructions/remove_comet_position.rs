use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct RemoveCometPosition<'info> {
    #[account(address = comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet @ CloneError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ CloneError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
}

pub fn execute(ctx: Context<RemoveCometPosition>, comet_position_index: u8) -> Result<()> {
    let mut comet = ctx.accounts.comet.load_mut()?;
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
