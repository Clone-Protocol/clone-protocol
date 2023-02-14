use crate::config::{FEE_CLAIM_INTERVAL_SLOTS, MAX_STRIKES, REPLENISH_STRIKE_INTERVAL};
use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use incept::return_error_if_false;
use incept::states::DEVNET_TOKEN_SCALE;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
pub struct ManagementFeeClaim<'info> {
    #[account(address = manager_info.owner)]
    pub manager_owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_owner.to_account_info().key().as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        seeds = [b"subscriber", manager_owner.to_account_info().key().as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub owner_account: Box<Account<'info, Subscriber>>,
}

pub fn execute(ctx: Context<ManagementFeeClaim>) -> Result<()> {
    // Calculate membership amount to mint
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        InceptCometManagerError::OpenStatusRequired
    );
    let current_slot = Clock::get()?.slot;
    return_error_if_false!(
        current_slot >= ctx.accounts.manager_info.fee_claim_slot + FEE_CLAIM_INTERVAL_SLOTS,
        InceptCometManagerError::TooEarlyToClaimReward
    );
    return_error_if_false!(
        (ctx.accounts.manager_info.redemption_strikes as u64) < MAX_STRIKES,
        InceptCometManagerError::ManagerAtStrikeLimit
    );

    let management_fee_rate = Decimal::new(
        ctx.accounts
            .manager_info
            .management_fee_bps
            .try_into()
            .unwrap(),
        4,
    );
    let total_membership_token_supply = Decimal::new(
        ctx.accounts
            .manager_info
            .membership_token_supply
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let mut membership_token_to_mint =
        total_membership_token_supply * management_fee_rate / (Decimal::ONE - management_fee_rate);
    membership_token_to_mint.rescale(DEVNET_TOKEN_SCALE);

    // Mint membership
    let tokens_to_add: u64 = membership_token_to_mint.mantissa().try_into().unwrap();
    ctx.accounts.owner_account.membership_tokens += tokens_to_add;
    // Adjust supply
    ctx.accounts.manager_info.membership_token_supply += tokens_to_add;
    // Update slot
    ctx.accounts.manager_info.fee_claim_slot = current_slot;

    if current_slot
        >= ctx
            .accounts
            .manager_info
            .last_strike_timestamp
            .to_u64()
            .unwrap()
            + REPLENISH_STRIKE_INTERVAL
        && ctx.accounts.manager_info.redemption_strikes > 0
    {
        ctx.accounts.manager_info.redemption_strikes -= 1;
    }

    Ok(())
}
