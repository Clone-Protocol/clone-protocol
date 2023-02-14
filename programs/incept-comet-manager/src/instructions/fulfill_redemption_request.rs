use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use incept::cpi::accounts::WithdrawCollateralFromComet;
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{
    Comet, Incept, TokenData, User, BPS_SCALE, DEVNET_TOKEN_SCALE, USDI_COLLATERAL_INDEX,
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
        address = manager_info.incept
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [b"subscriber", manager_info.user_redemptions[index as usize].as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
    )]
    pub subscriber_account: Box<Account<'info, Subscriber>>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info.user_redemptions[index as usize]
    )]
    pub subscriber_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.incept_program
    )]
    pub incept_program: Program<'info, InceptProgram>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.token_data
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

pub fn execute(ctx: Context<FulfillRedemptionRequest>, index: u8) -> Result<()> {
    // Calculate usdi value to withdraw according to tokens redeemed.
    let token_data = ctx.accounts.token_data.load()?;
    let comet = ctx.accounts.comet.load()?;
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        InceptCometManagerError::OpenStatusRequired
    );

    return_error_if_false!(
        ctx.accounts.subscriber_account.redemption_request.is_some(),
        InceptCometManagerError::InvalidIndex
    );

    let redemption_request = ctx.accounts.subscriber_account.redemption_request.unwrap();

    let estimated_usdi_comet_value = comet.estimate_usdi_value(&token_data);
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

    let mut usdi_collateral_to_withdraw =
        estimated_usdi_comet_value * tokens_redeemed / membership_token_supply;
    usdi_collateral_to_withdraw.rescale(DEVNET_TOKEN_SCALE);

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
                incept: ctx.accounts.incept.to_account_info(),
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
