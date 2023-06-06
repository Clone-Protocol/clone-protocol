use crate::config::MAX_STRIKES;
use crate::config::TERMINATION_TIMEOUT_SECONDS;
use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use clone::{
    return_error_if_false,
    states::{Comet, User},
};

#[derive(Accounts)]
pub struct InitiateCometManagerClosing<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.user_account
    )]
    pub manager_clone_user: Box<Account<'info, User>>,
    #[account(
        address = manager_clone_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
}

pub fn execute(ctx: Context<InitiateCometManagerClosing>) -> Result<()> {
    // Calculate onUSD value to withdraw according to tokens redeemed.
    // Withdraw collateral from comet
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        CloneCometManagerError::OpenStatusRequired
    );
    let forcefully_closed = (ctx.accounts.manager_info.redemption_strikes as u64) >= MAX_STRIKES;
    let comet = ctx.accounts.comet.load()?;

    if !forcefully_closed {
        return_error_if_false!(
            ctx.accounts.signer.key() == ctx.accounts.manager_info.owner,
            CloneCometManagerError::RequireManagerAtStrikeLimit
        );
        return_error_if_false!(
            comet.num_positions == 0,
            CloneCometManagerError::CometMustHaveNoPositions
        );
        return_error_if_false!(
            ctx.accounts.manager_info.user_redemptions.is_empty(),
            CloneCometManagerError::RedemptionsMustBeFulfilled
        );
        return_error_if_false!(
            comet.collaterals[0usize]
                .collateral_amount
                .to_decimal()
                .is_zero(),
            CloneCometManagerError::CometMustHaveNoPositions
        );
    }

    let termination_timestamp: u64 =
        (Clock::get()?.unix_timestamp as u64) + TERMINATION_TIMEOUT_SECONDS;

    ctx.accounts.manager_info.status = CometManagerStatus::Closing {
        forcefully_closed,
        termination_timestamp,
    };

    Ok(())
}
