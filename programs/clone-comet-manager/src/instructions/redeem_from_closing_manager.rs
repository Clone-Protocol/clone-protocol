use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use clone::cpi::accounts::WithdrawCollateralFromComet;
use clone::math::rescale_toward_zero;
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{
    Comet, Clone, TokenData, User, BPS_SCALE, DEVNET_TOKEN_SCALE, ONUSD_COLLATERAL_INDEX,
};
use rust_decimal::prelude::*;

#[derive(Accounts)]
pub struct RedeemFromClosingManager<'info> {
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
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = subscriber
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
        address = manager_clone_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
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

pub fn execute(ctx: Context<RedeemFromClosingManager>) -> Result<()> {
    // Calculate onUSD value to withdraw according to tokens redeemed.
    return_error_if_false!(
        matches!(
            ctx.accounts.manager_info.status,
            CometManagerStatus::Closing { .. }
        ),
        CloneCometManagerError::ClosingStatusRequired
    );

    let comet = ctx.accounts.comet.load()?;
    return_error_if_false!(
        comet.num_positions == 0,
        CloneCometManagerError::CometMustHaveNoPositions
    );

    let membership_tokens_to_redeem = ctx.accounts.subscriber_account.membership_tokens;
    return_error_if_false!(
        membership_tokens_to_redeem > 0,
        CloneCometManagerError::InvalidMembershipTokenBalance
    );

    let token_data = ctx.accounts.token_data.load()?;
    let estimated_onusd_comet_value = ctx.accounts.manager_info.current_onusd_value()?;
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

    drop(comet);
    drop(token_data);
    clone::cpi::withdraw_collateral_from_comet(
        CpiContext::new_with_signer(
            ctx.accounts.clone_program.to_account_info(),
            WithdrawCollateralFromComet {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.manager_clone_user.to_account_info(),
                clone: ctx.accounts.clone.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
                vault: ctx.accounts.clone_onusd_vault.to_account_info(),
                user_collateral_token_account: ctx
                    .accounts
                    .manager_onusd_token_account
                    .to_account_info(),
            },
            manager_seeds,
        ),
        0,
        onusd_collateral_to_withdraw.mantissa().try_into().unwrap(),
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

    let (withdrawal_fee_rate, management_fee_rate) = match ctx.accounts.manager_info.status {
        CometManagerStatus::Closing {
            forcefully_closed, ..
        } => {
            if forcefully_closed {
                (Decimal::ZERO, Decimal::ZERO)
            } else {
                (
                    Decimal::new(
                        ctx.accounts
                            .manager_info
                            .withdrawal_fee_bps
                            .try_into()
                            .unwrap(),
                        BPS_SCALE,
                    ),
                    Decimal::new(
                        ctx.accounts
                            .manager_info
                            .management_fee_bps
                            .try_into()
                            .unwrap(),
                        BPS_SCALE,
                    ),
                )
            }
        }
        _ => (Decimal::ZERO, Decimal::ZERO),
    };
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

    // Burn membership tokens from total supply.
    ctx.accounts.manager_info.membership_token_supply -= membership_tokens_to_redeem;
    ctx.accounts.subscriber_account.principal = 0;
    ctx.accounts.subscriber_account.membership_tokens = 0;

    Ok(())
}
