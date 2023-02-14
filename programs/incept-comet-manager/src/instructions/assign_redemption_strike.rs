use crate::config::{MAX_STRIKES, REDEMPTION_TIME_WINDOW};
use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use incept::return_error_if_false;

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct AssignRedemptionStrike<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        seeds = [b"subscriber", manager_info.user_redemptions[index as usize].key().as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub subscriber_account: Box<Account<'info, Subscriber>>,
}

pub fn execute(ctx: Context<AssignRedemptionStrike>, index: u8) -> Result<()> {
    // Calculate usdi value to withdraw according to tokens redeemed.
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        InceptCometManagerError::OpenStatusRequired
    );
    return_error_if_false!(
        (index as usize) < ctx.accounts.manager_info.user_redemptions.len()
            && ctx.accounts.subscriber_account.redemption_request.is_some(),
        InceptCometManagerError::InvalidIndex
    );

    let request_redemption = ctx.accounts.subscriber_account.redemption_request.unwrap();

    let current_timestamp = Clock::get()?.unix_timestamp.try_into().unwrap();

    let strike_intervals: u64 =
        (current_timestamp - request_redemption.timestamp) / REDEMPTION_TIME_WINDOW;

    return_error_if_false!(
        strike_intervals > 0,
        InceptCometManagerError::RequestNotValidForStrike
    );
    ctx.accounts.subscriber_account.redemption_request = Some(RedemptionRequest {
        membership_tokens: request_redemption.membership_tokens,
        timestamp: current_timestamp,
    });

    let redemption_strikes =
        (ctx.accounts.manager_info.redemption_strikes as u64) + strike_intervals;
    ctx.accounts.manager_info.redemption_strikes += redemption_strikes.max(MAX_STRIKES) as u8;
    ctx.accounts.manager_info.last_strike_timestamp = current_timestamp;

    Ok(())
}
