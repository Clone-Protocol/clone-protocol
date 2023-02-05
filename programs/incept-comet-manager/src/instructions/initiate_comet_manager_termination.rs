use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use incept::{
    return_error_if_false,
    states::{Comet, User},
};

#[cfg(feature = "local-testing")]
const TERMINATION_SLOT_TIMEOUT: u64 = 0;
#[cfg(not(feature = "local-testing"))]
const TERMINATION_SLOT_TIMEOUT: u64 = 4838400;

#[derive(Accounts)]
pub struct InitiateCometManagerTermination<'info> {
    pub manager_owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_owner.key.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
}

pub fn execute(ctx: Context<InitiateCometManagerTermination>) -> Result<()> {
    // Calculate usdi value to withdraw according to tokens redeemed.
    // Withdraw collateral from comet
    return_error_if_false!(
        !ctx.accounts.manager_info.in_closing_sequence,
        InceptCometManagerError::InvalidActionWhenInTerminationSequence
    );
    return_error_if_false!(
        ctx.accounts.comet.load()?.num_positions == 0,
        InceptCometManagerError::CometMustHaveNoPositions
    );

    ctx.accounts.manager_info.in_closing_sequence = true;
    ctx.accounts.manager_info.termination_slot = Clock::get()?.slot + TERMINATION_SLOT_TIMEOUT;

    Ok(())
}
