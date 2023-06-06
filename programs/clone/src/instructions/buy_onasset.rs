use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( pool_index: u8, onasset_amount: u64, onusd_amount_threshold: u64)]
pub struct BuyOnAsset<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = (pool_index as u64) < token_data.load()?.num_pools @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[pool_index as usize].deprecated == 0 @ CloneError::PoolDeprecated
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        associated_token::mint = clone.onusd_mint,
        associated_token::authority = user
    )]
    pub user_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onusd_token_account,
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onasset_token_account,
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<BuyOnAsset>,
    pool_index: u8,
    amount: u64,
    onusd_spend_threshold: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];

    let onasset_amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    // calculate how much onusd must be spent
    let swap_summary = pool.calculate_input_from_output(onasset_amount_value, false);
    let onusd_amount_value = rescale_toward_zero(swap_summary.result, DEVNET_TOKEN_SCALE);
    // ensure that the user has sufficient onusd
    return_error_if_false!(
        ctx.accounts.user_onusd_token_account.amount
            >= onusd_amount_value.mantissa().try_into().unwrap(),
        CloneError::InvalidTokenAmount
    );
    // ensure it's within slippage tolerance
    let max_onusd_to_spend =
        Decimal::new(onusd_spend_threshold.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    return_error_if_false!(
        max_onusd_to_spend >= onusd_amount_value,
        CloneError::SlippageToleranceExceeded
    );

    // transfer onusd from user to amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_onusd_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .amm_onusd_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let send_onusd_to_amm_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::transfer(
        send_onusd_to_amm_context,
        onusd_amount_value.mantissa().try_into().unwrap(),
    )?;

    // transfer onasset to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_onasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let send_onasset_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_onasset_to_user_context,
        onasset_amount_value.mantissa().try_into().unwrap(),
    )?;

    // Transfer treasury fee from pool to treasury token account
    let treasury_fee_to_pay =
        rescale_toward_zero(swap_summary.treasury_fees_paid, DEVNET_TOKEN_SCALE);
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_onasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .treasury_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let send_onasset_to_treasury_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_onasset_to_treasury_context,
        treasury_fee_to_pay.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    ctx.accounts.amm_onasset_token_account.reload()?;
    ctx.accounts.amm_onusd_token_account.reload()?;
    token_data.pools[pool_index as usize].onasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_onasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].onusd_amount = RawDecimal::new(
        ctx.accounts
            .amm_onusd_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let trading_fees = rescale_toward_zero(swap_summary.liquidity_fees_paid, DEVNET_TOKEN_SCALE);

    emit!(SwapEvent {
        event_id: ctx.accounts.clone.event_counter,
        user: ctx.accounts.user.key(),
        pool_index,
        is_buy: true,
        onasset: amount,
        onusd: onusd_amount_value.mantissa().try_into().unwrap(),
        trading_fee: trading_fees.mantissa().try_into().unwrap(),
        treasury_fee: treasury_fee_to_pay.mantissa().try_into().unwrap()
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index,
        onasset: ctx.accounts.amm_onasset_token_account.amount,
        onusd: ctx.accounts.amm_onusd_token_account.amount,
        lp_tokens: pool
            .liquidity_token_supply
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
