use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use clone::math::rescale_toward_zero;
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{
    Clone, TokenData, User, BPS_SCALE, DEVNET_TOKEN_SCALE, ONUSD_COLLATERAL_INDEX,
};
use rust_decimal::prelude::*;

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct FulfillRedemptionRequest<'info> {
    #[account(address = manager_info.owner)]
    pub manager_owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_owner.key().as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        address = manager_info.clone
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_clone_user: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [b"subscriber", manager_info.user_redemptions[index as usize].as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub subscriber_account: Box<Account<'info, Subscriber>>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_info.user_redemptions[index as usize]
    )]
    pub subscriber_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_info
    )]
    pub manager_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.clone_program
    )]
    pub clone_program: Program<'info, CloneProgram>,
    #[account(
        mut,
        address = clone.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[ONUSD_COLLATERAL_INDEX].vault
    )]
    pub clone_onusd_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<FulfillRedemptionRequest>, index: u8) -> Result<()> {
    // Calculate onusd value to withdraw according to tokens redeemed.
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        CloneCometManagerError::OpenStatusRequired
    );

    return_error_if_false!(
        ctx.accounts.subscriber_account.redemption_request.is_some(),
        CloneCometManagerError::InvalidIndex
    );

    let redemption_request = ctx.accounts.subscriber_account.redemption_request.unwrap();

    let estimated_onusd_comet_value = ctx.accounts.manager_info.current_onusd_value()?;
    let tokens_redeemed = Decimal::new(
        redemption_request.membership_tokens.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let membership_token_supply = Decimal::new(
        ctx.accounts
            .manager_info
            .membership_token_supply
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let onusd_collateral_to_withdraw = rescale_toward_zero(
        estimated_onusd_comet_value * tokens_redeemed / membership_token_supply,
        DEVNET_TOKEN_SCALE,
    );

    // Withdraw collateral from comet
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];

    // Calculate how much to reduce on the subscribers principal as well as reward to the manager.
    let principal_value = Decimal::new(
        ctx.accounts
            .subscriber_account
            .principal
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let subscriber_membership_tokens = Decimal::new(
        ctx.accounts
            .subscriber_account
            .membership_tokens
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let withdrawal_fee_rate = Decimal::new(
        ctx.accounts
            .manager_info
            .withdrawal_fee_bps
            .try_into()
            .unwrap(),
        BPS_SCALE,
    );

    let management_fee_rate = Decimal::new(
        ctx.accounts
            .manager_info
            .management_fee_bps
            .try_into()
            .unwrap(),
        BPS_SCALE,
    );

    // Calculate the profit to send to subscriber, fees for management and principal deficit.
    let total_claimable_value =
        estimated_onusd_comet_value * subscriber_membership_tokens / membership_token_supply;

    let mut onusd_to_subscriber = if principal_value > Decimal::ZERO {
        // Effective return will be zero if unprofitable.
        let effective_return = total_claimable_value / principal_value - Decimal::ONE;
        let total_profit = onusd_collateral_to_withdraw * effective_return;
        let total_manager_fee = (total_profit * withdrawal_fee_rate)
            .max(onusd_collateral_to_withdraw * management_fee_rate);

        // Adjust principal
        let principal_value_deficit = rescale_toward_zero(
            onusd_collateral_to_withdraw - total_profit,
            DEVNET_TOKEN_SCALE,
        );
        let principal_mantissa: u64 = principal_value_deficit.mantissa().try_into().unwrap();
        ctx.accounts.subscriber_account.principal -=
            principal_mantissa.min(ctx.accounts.subscriber_account.principal);

        onusd_collateral_to_withdraw - total_manager_fee
    } else {
        // No principal pure reward
        onusd_collateral_to_withdraw * (Decimal::ONE - withdrawal_fee_rate)
    };

    // Transfer onUSD back to redeemer
    onusd_to_subscriber = rescale_toward_zero(onusd_to_subscriber, DEVNET_TOKEN_SCALE);
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.manager_onusd_token_account.to_account_info(),
                to: ctx.accounts.subscriber_onusd_token_account.to_account_info(),
                authority: ctx.accounts.manager_info.to_account_info(),
            },
            manager_seeds,
        ),
        onusd_to_subscriber.mantissa().try_into().unwrap(),
    )?;

    // Burn membership tokens from total supply and user supply
    ctx.accounts.manager_info.membership_token_supply -= redemption_request.membership_tokens;
    ctx.accounts.subscriber_account.membership_tokens -= redemption_request.membership_tokens;
    if ctx.accounts.subscriber_account.membership_tokens == 0 {
        ctx.accounts.subscriber_account.principal = 0;
    }

    ctx.accounts.subscriber_account.redemption_request = None;
    // Remove from user_redemptions
    ctx.accounts
        .manager_info
        .user_redemptions
        .remove(index as usize);

    Ok(())
}
