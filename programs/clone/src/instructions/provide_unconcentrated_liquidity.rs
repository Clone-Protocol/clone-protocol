use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, onasset_amount: u64)]
pub struct ProvideUnconcentratedLiquidity<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
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
        constraint = user_onasset_token_account.amount >= onasset_amount @ CloneError::InvalidTokenAccountBalance,
        associated_token::mint = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = liquidity_token_mint,
        associated_token::authority = user
    )]
    pub user_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onusd_token_account
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onasset_token_account
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<ProvideUnconcentratedLiquidity>,
    pool_index: u8,
    onasset_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];

    let onasset_liquidity_value =
        Decimal::new(onasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
    let onasset_amm_value = Decimal::new(
        ctx.accounts
            .amm_onasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let onusd_amm_value = Decimal::new(
        ctx.accounts
            .amm_onusd_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let liquidity_token_supply = Decimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    // calculate amount of onusd required as well as amount of liquidity tokens to be received
    let (onusd_liquidity_value, liquidity_token_value) = if pool.is_empty() {
        // ensure price data is up to date
        check_feed_update(pool.asset_info, Clock::get()?.slot)?;
        let onusd_value = onasset_liquidity_value * pool.asset_info.price.to_decimal();
        // Arbitrarily set the starting LP tokens as the onusd value.
        (
            rescale_toward_zero(onusd_value, DEVNET_TOKEN_SCALE),
            rescale_toward_zero(Decimal::new(10, 0) * onusd_value, DEVNET_TOKEN_SCALE),
        )
    } else {
        let onusd_value =
            calculate_amm_price(onasset_amm_value, onusd_amm_value) * onasset_liquidity_value;
        (
            rescale_toward_zero(onusd_value, DEVNET_TOKEN_SCALE),
            rescale_toward_zero(
                liquidity_token_supply
                    * calculate_liquidity_proportion_from_onusd(onusd_value, onusd_amm_value)?,
                DEVNET_TOKEN_SCALE,
            ),
        )
    };

    // transfer onasset from user to amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .amm_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let send_onasset_to_amm_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::transfer(send_onasset_to_amm_context, onasset_amount)?;

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
        onusd_liquidity_value.mantissa().try_into().unwrap(),
    )?;

    // mint liquidity tokens to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    ctx.accounts.amm_onasset_token_account.reload()?;
    ctx.accounts.amm_onusd_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

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
    token_data.pools[pool_index as usize].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user: ctx.accounts.user.key(),
        pool_index,
        is_concentrated: false,
        lp_token_delta: liquidity_token_value.mantissa().try_into().unwrap(),
        onusd_delta: onusd_liquidity_value.mantissa().try_into().unwrap(),
        onasset_delta: onasset_amount.try_into().unwrap(),
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
