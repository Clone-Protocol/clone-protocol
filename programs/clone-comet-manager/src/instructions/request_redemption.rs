use crate::config::MIN_TOKEN_WITHDRAWAL;
use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use clone::return_error_if_false;
use clone::states::DEVNET_TOKEN_SCALE;
use rust_decimal::prelude::*;

#[derive(Accounts)]
#[instruction(membership_tokens_to_redeem: u64)]
pub struct RequestRedemption<'info> {
    #[account(address = subscriber_account.owner)]
    pub subscriber: Signer<'info>,
    #[account(
        mut,
        seeds = [b"subscriber", subscriber.to_account_info().key.as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub subscriber_account: Box<Account<'info, Subscriber>>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
        address = subscriber_account.manager,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
}

pub fn execute(ctx: Context<RequestRedemption>, membership_tokens_to_redeem: u64) -> Result<()> {
    // Calculate onUSD value to withdraw according to tokens redeemed.
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        CloneCometManagerError::OpenStatusRequired
    );

    // TODO: need to calculate min tokens withdrawable.
    return_error_if_false!(
        membership_tokens_to_redeem <= ctx.accounts.subscriber_account.membership_tokens,
        CloneCometManagerError::WithdrawalAmountInvalid
    );
    return_error_if_false!(
        MIN_TOKEN_WITHDRAWAL
            <= Decimal::new(
                membership_tokens_to_redeem.try_into().unwrap(),
                DEVNET_TOKEN_SCALE
            ),
        CloneCometManagerError::WithdrawalAmountInvalid
    );
    // Leftover amount should be withdrawable.
    let leftover_tokens = Decimal::new(
        (ctx.accounts.subscriber_account.membership_tokens - membership_tokens_to_redeem)
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    if !leftover_tokens.is_zero() {
        return_error_if_false!(
            MIN_TOKEN_WITHDRAWAL <= leftover_tokens,
            CloneCometManagerError::WithdrawalAmountInvalid
        );
    }

    // Queue should not be full.
    return_error_if_false!(
        ctx.accounts.manager_info.user_redemptions.len() < MAX_USER_REDEMPTIONS,
        CloneCometManagerError::OutstandingRedemptionsQueueFull
    );

    // No outstanding request from user.
    return_error_if_false!(
        !ctx.accounts
            .manager_info
            .user_redemptions
            .contains(ctx.accounts.subscriber.key)
            && ctx.accounts.subscriber_account.redemption_request.is_none(),
        CloneCometManagerError::RequestAlreadySent
    );

    ctx.accounts
        .manager_info
        .user_redemptions
        .push(ctx.accounts.subscriber.key());
    ctx.accounts.subscriber_account.redemption_request = Some(RedemptionRequest {
        membership_tokens: membership_tokens_to_redeem,
        timestamp: Clock::get()?.unix_timestamp.try_into().unwrap(),
    });

    Ok(())
}
