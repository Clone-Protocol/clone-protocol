use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawUnconcentratedLiquidity<'info> {
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
        constraint = user_liquidity_token_account.amount >= liquidity_token_amount @ CloneError::InvalidTokenAccountBalance,
        associated_token::mint = liquidity_token_mint,
        associated_token::authority = user
    )]
    pub user_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onusd_token_account,
        constraint = amm_onusd_token_account.amount > 0 @ CloneError::InvalidTokenAccountBalance
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onasset_token_account,
        constraint = amm_onasset_token_account.amount > 0 @ CloneError::InvalidTokenAccountBalance
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
    ctx: Context<WithdrawUnconcentratedLiquidity>,
    pool_index: u8,
    liquidity_token_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
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

    // calculate the amount of onasset and onusd that the user can withdraw
    let (mut onasset_value, mut onusd_value) =
        calculate_liquidity_provider_values_from_liquidity_tokens(
            liquidity_token_value,
            onasset_amm_value,
            onusd_amm_value,
            liquidity_token_supply,
        )?;

    onasset_value = rescale_toward_zero(onasset_value, DEVNET_TOKEN_SCALE);
    onusd_value = rescale_toward_zero(onusd_value, DEVNET_TOKEN_SCALE);

    // burn user liquidity tokens
    let cpi_accounts = Burn {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();

    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        liquidity_token_amount,
    )?;

    // transfer onusd to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_onusd_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_onusd_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let send_onusd_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_onusd_to_user_context,
        onusd_value.mantissa().try_into().unwrap(),
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
        onasset_value.mantissa().try_into().unwrap(),
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
        lp_token_delta: -(liquidity_token_value.mantissa() as i64),
        onusd_delta: -(onusd_value.mantissa() as i64),
        onasset_delta: -(onasset_value.mantissa() as i64),
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
