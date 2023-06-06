use crate::config::MIN_COLLATERAL_DEPOSIT;
use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use clone::math::rescale_toward_zero;
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{Clone, TokenData, User, DEVNET_TOKEN_SCALE, ONUSD_COLLATERAL_INDEX};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(collateral_to_provide: u64)]
pub struct Subscribe<'info> {
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
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.clone
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
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

pub fn execute(ctx: Context<Subscribe>, collateral_to_provide: u64) -> Result<()> {
    // Calculate membership amount to mint
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        CloneCometManagerError::OpenStatusRequired
    );
    let onusd_collateral_contribution = Decimal::new(
        collateral_to_provide.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    return_error_if_false!(
        onusd_collateral_contribution >= MIN_COLLATERAL_DEPOSIT,
        CloneCometManagerError::DepositAmountTooLow
    );

    let mut membership_token_to_mint = if ctx.accounts.manager_info.membership_token_supply == 0 {
        onusd_collateral_contribution
    } else {
        let estimated_onusd_comet_value = ctx.accounts.manager_info.current_onusd_value()?;
        onusd_collateral_contribution / (onusd_collateral_contribution + estimated_onusd_comet_value)
    };
    membership_token_to_mint = rescale_toward_zero(membership_token_to_mint, DEVNET_TOKEN_SCALE);

    // Mint membership
    let tokens_to_add: u64 = membership_token_to_mint.mantissa().try_into().unwrap();
    ctx.accounts.subscriber_account.membership_tokens += tokens_to_add;
    ctx.accounts.manager_info.membership_token_supply += tokens_to_add;
    // Adjust principal
    ctx.accounts.subscriber_account.principal += collateral_to_provide;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                from: ctx
                    .accounts
                    .subscriber_onusd_token_account
                    .to_account_info()
                    .clone(),
                to: ctx
                    .accounts
                    .manager_onusd_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.subscriber.to_account_info().clone(),
            },
        ),
        collateral_to_provide,
    )?;

    Ok(())
}
