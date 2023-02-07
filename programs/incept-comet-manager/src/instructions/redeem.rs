use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use incept::cpi::accounts::WithdrawCollateralFromComet;
use incept::error::InceptError;
use incept::math::calculate_health_score;
use incept::program::Incept;
use incept::return_error_if_false;
use incept::states::{Comet, Manager, TokenData, User, DEVNET_TOKEN_SCALE, USDI_COLLATERAL_INDEX};
use rust_decimal::prelude::*;

#[derive(Accounts)]
#[instruction(membership_tokens_to_redeem: u64)]
pub struct Redeem<'info> {
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
    #[account(
        address = manager_info.incept_manager
    )]
    pub incept_manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        mut,
        address = incept_manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = subscriber
    )]
    pub subscriber_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.incept
    )]
    pub incept_program: Program<'info, Incept>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept_manager.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault
    )]
    pub incept_usdi_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<Redeem>, membership_tokens_to_redeem: u64) -> Result<()> {
    // Calculate usdi value to withdraw according to tokens redeemed.
    let token_data = ctx.accounts.token_data.load()?;
    let comet = ctx.accounts.comet.load()?;

    let current_health_score = calculate_health_score(&comet, &token_data, None)?;
    let health_score_threshold =
        Decimal::new(ctx.accounts.manager_info.health_score_threshold.into(), 0);

    return_error_if_false!(
        current_health_score.score > health_score_threshold,
        InceptError::HealthScoreTooLow
    );
    return_error_if_false!(
        membership_tokens_to_redeem > 0
            && membership_tokens_to_redeem <= ctx.accounts.subscriber_account.membership_tokens,
        InceptCometManagerError::InvalidMembershipTokenBalance
    );

    let estimated_usdi_comet_value = comet.estimate_usdi_value(&token_data);
    let tokens_redeemed = Decimal::new(
        membership_tokens_to_redeem.try_into().unwrap(),
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

    let mut usdi_collateral_to_withdraw =
        estimated_usdi_comet_value * tokens_redeemed / membership_token_supply;
    usdi_collateral_to_withdraw.rescale(DEVNET_TOKEN_SCALE);

    let estimated_health_score_after_redemption = if current_health_score.total_il_term.is_zero()
        && current_health_score.total_position_term.is_zero()
    {
        Decimal::new(100, 0)
    } else {
        Decimal::new(100, 0)
            - (current_health_score.total_il_term + current_health_score.total_position_term)
                / (current_health_score.effective_collateral - usdi_collateral_to_withdraw)
    };

    return_error_if_false!(
        estimated_health_score_after_redemption >= health_score_threshold,
        InceptError::HealthScoreTooLow
    );

    // Withdraw collateral from comet
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];

    drop(comet);
    drop(token_data);
    incept::cpi::withdraw_collateral_from_comet(
        CpiContext::new_with_signer(
            ctx.accounts.incept_program.to_account_info(),
            WithdrawCollateralFromComet {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.manager_incept_user.to_account_info(),
                manager: ctx.accounts.incept_manager.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
                vault: ctx.accounts.incept_usdi_vault.to_account_info(),
                user_collateral_token_account: ctx
                    .accounts
                    .manager_usdi_token_account
                    .to_account_info(),
            },
            manager_seeds,
        ),
        0,
        usdi_collateral_to_withdraw.mantissa().try_into().unwrap(),
    )?;

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

    // Calculate the profit to send to subscriber, fees for management and principal deficit.
    let withdrawal_fee_rate = Decimal::new(
        ctx.accounts
            .manager_info
            .withdrawal_fee_bps
            .try_into()
            .unwrap(),
        4,
    );
    let management_fee_rate = Decimal::new(
        ctx.accounts
            .manager_info
            .management_fee_bps
            .try_into()
            .unwrap(),
        4,
    );
    let total_claimable_value =
        estimated_usdi_comet_value * subscriber_membership_tokens / membership_token_supply;

    let mut usdi_to_subscriber = if principal_value > Decimal::ZERO {
        // Effective return will be zero if unprofitable.
        let effective_return = total_claimable_value / principal_value - Decimal::ONE;
        let total_profit = usdi_collateral_to_withdraw * effective_return;
        let total_manager_fee = (total_profit * withdrawal_fee_rate)
            .max(usdi_collateral_to_withdraw * management_fee_rate);

        // Adjust principal
        let mut principal_value_deficit = usdi_collateral_to_withdraw - total_profit;
        principal_value_deficit.rescale(DEVNET_TOKEN_SCALE);
        let principal_mantissa: u64 = principal_value_deficit.mantissa().try_into().unwrap();
        ctx.accounts.subscriber_account.principal -=
            principal_mantissa.min(ctx.accounts.subscriber_account.principal);

        usdi_collateral_to_withdraw - total_manager_fee
    } else {
        // No principal pure reward
        usdi_collateral_to_withdraw * (Decimal::ONE - withdrawal_fee_rate)
    };

    // Transfer USDi back to redeemer
    usdi_to_subscriber.rescale(DEVNET_TOKEN_SCALE);
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.manager_usdi_token_account.to_account_info(),
                to: ctx.accounts.subscriber_usdi_token_account.to_account_info(),
                authority: ctx.accounts.manager_info.to_account_info(),
            },
            manager_seeds,
        ),
        usdi_to_subscriber.mantissa().try_into().unwrap(),
    )?;

    // Burn membership tokens from total supply.
    ctx.accounts.manager_info.membership_token_supply -= membership_tokens_to_redeem;

    // Adjust subscriber tokens, if fully redeemed, set principal to zero.
    if ctx.accounts.subscriber_account.membership_tokens == membership_tokens_to_redeem {
        ctx.accounts.subscriber_account.principal = 0;
    }
    ctx.accounts.subscriber_account.membership_tokens -= membership_tokens_to_redeem;

    Ok(())
}
