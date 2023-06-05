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
#[instruction( pool_index: u8, iasset_amount: u64, usdi_amount_threshold: u64)]
pub struct SellIasset<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        has_one = incept,
        constraint = (pool_index as u64) < token_data.load()?.num_pools @ InceptError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[pool_index as usize].deprecated == false @ InceptError::PoolDeprecated
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        associated_token::mint = incept.usdi_mint,
        associated_token::authority = user
    )]
    pub user_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_iasset_token_account.amount >= iasset_amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = token_data.load()?.pools[pool_index as usize].asset_info.iasset_mint,
        associated_token::authority = user
    )]
    pub user_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].iasset_token_account,
        constraint = amm_iasset_token_account.amount >= iasset_amount @ InceptError::InvalidTokenAccountBalance,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = incept.usdi_mint,
        associated_token::authority = incept.treasury_address
    )]
    pub treasury_usdi_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<SellIasset>,
    pool_index: u8,
    amount: u64,
    usdi_received_threshold: u64,
) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];

    let iasset_amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    // calculate how much usdi will be recieved
    let swap_summary = pool.calculate_output_from_input(iasset_amount_value, false);
    let usdi_amount_value = rescale_toward_zero(swap_summary.result, DEVNET_TOKEN_SCALE);
    // ensure it's within slippage tolerance
    let min_usdi_to_receive = Decimal::new(
        usdi_received_threshold.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    return_error_if_false!(
        usdi_amount_value >= min_usdi_to_receive,
        InceptError::SlippageToleranceExceeded
    );

    // transfer iasset from user to amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .amm_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let send_iasset_to_amm_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::transfer(send_iasset_to_amm_context, amount)?;

    // transfer usdi to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let send_usdi_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_usdi_to_user_context,
        usdi_amount_value.mantissa().try_into().unwrap(),
    )?;

    // Transfer treasury fee to treasury token account
    let treasury_fee_to_pay =
        rescale_toward_zero(swap_summary.treasury_fees_paid, DEVNET_TOKEN_SCALE);
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .treasury_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let send_usdi_to_treasury_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_usdi_to_treasury_context,
        treasury_fee_to_pay.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    token_data.pools[pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let trading_fees = rescale_toward_zero(swap_summary.liquidity_fees_paid, DEVNET_TOKEN_SCALE);

    emit!(SwapEvent {
        event_id: ctx.accounts.incept.event_counter,
        user: ctx.accounts.user.key(),
        pool_index,
        is_buy: false,
        iasset: amount,
        usdi: usdi_amount_value.mantissa().try_into().unwrap(),
        trading_fee: trading_fees.mantissa().try_into().unwrap(),
        treasury_fee: treasury_fee_to_pay.mantissa().try_into().unwrap()
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.incept.event_counter,
        pool_index,
        iasset: ctx.accounts.amm_iasset_token_account.amount,
        usdi: ctx.accounts.amm_usdi_token_account.amount,
        lp_tokens: pool
            .liquidity_token_supply
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.incept.event_counter += 1;

    Ok(())
}
