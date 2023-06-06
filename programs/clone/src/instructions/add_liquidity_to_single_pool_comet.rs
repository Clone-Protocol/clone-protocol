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
#[instruction(position_index: u8, onusd_amount: u64)]
pub struct AddLiquidityToSinglePoolComet<'info> {
    #[account(address = single_pool_comet.load()?.owner)]
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
        has_one = token_data,
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.single_pool_comets,
        constraint = single_pool_comet.load()?.is_single_pool == 1 @ CloneError::WrongCometType,
        constraint = (position_index as u64) < single_pool_comet.load()?.num_positions @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].deprecated == 0 @ CloneError::PoolDeprecated
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].onusd_token_account,
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].onasset_token_account,
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].liquidity_token_mint,
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<AddLiquidityToSinglePoolComet>,
    position_index: u8,
    onusd_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.single_pool_comet.load_mut()?;

    let pool_index = comet.positions[position_index as usize].pool_index as usize;
    let pool = token_data.pools[pool_index];
    let empty_pool = pool.is_empty();

    let onusd_liquidity_value = Decimal::new(onusd_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

    // calculate onasset liquidity value as well as liquidity token value for comet
    let (mut onasset_liquidity_value, mut liquidity_token_value) =
        calculate_liquidity_provider_values_from_onusd(
            onusd_liquidity_value,
            onasset_amm_value,
            onusd_amm_value,
            liquidity_token_supply,
            pool.asset_info.price.to_decimal(),
        )?;

    let position = comet.positions[position_index as usize];
    // update comet position data
    let borrowed_onusd = rescale_toward_zero(
        position.borrowed_onusd.to_decimal() + onusd_liquidity_value,
        DEVNET_TOKEN_SCALE,
    );
    let borrowed_onasset = rescale_toward_zero(
        position.borrowed_onasset.to_decimal() + onasset_liquidity_value,
        DEVNET_TOKEN_SCALE,
    );

    liquidity_token_value += position.liquidity_token_value.to_decimal();
    liquidity_token_value = rescale_toward_zero(liquidity_token_value, DEVNET_TOKEN_SCALE);

    let lp_tokens_to_mint = rescale_toward_zero(
        liquidity_token_value
            - comet.positions[position_index as usize]
                .liquidity_token_value
                .to_decimal(),
        DEVNET_TOKEN_SCALE,
    );

    comet.positions[position_index as usize].borrowed_onusd = RawDecimal::from(borrowed_onusd);
    comet.positions[position_index as usize].borrowed_onasset = RawDecimal::from(borrowed_onasset);
    comet.positions[position_index as usize].liquidity_token_value =
        RawDecimal::from(liquidity_token_value);

    onasset_liquidity_value = rescale_toward_zero(onasset_liquidity_value, DEVNET_TOKEN_SCALE);

    // mint liquidity into amm
    let cpi_accounts = MintTo {
        mint: ctx.accounts.onusd_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .amm_onusd_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let mint_onusd_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    token::mint_to(mint_onusd_context, onusd_amount)?;
    let cpi_accounts = MintTo {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .amm_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let mint_onasset_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    token::mint_to(
        mint_onasset_context,
        onasset_liquidity_value.mantissa().try_into().unwrap(),
    )?;

    // mint liquidity tokens to comet
    let cpi_accounts = MintTo {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .comet_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let mint_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::mint_to(
        mint_liquidity_tokens_to_comet_context,
        lp_tokens_to_mint.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    ctx.accounts.amm_onasset_token_account.reload()?;
    ctx.accounts.amm_onusd_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[pool_index].onasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_onasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index].onusd_amount = RawDecimal::new(
        ctx.accounts
            .amm_onusd_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let pool = token_data.pools[pool_index];

    if !empty_pool {
        return_error_if_false!(
            liquidity_token_value / liquidity_token_supply
                <= pool.asset_info.max_ownership_pct.to_decimal(),
            CloneError::MaxPoolOwnershipExceeded
        );
    }

    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, token_data, Some(position_index as usize))?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user: ctx.accounts.user.key(),
        pool_index: pool_index.try_into().unwrap(),
        is_concentrated: true,
        lp_token_delta: lp_tokens_to_mint.mantissa().try_into().unwrap(),
        onusd_delta: onusd_amount as i64,
        onasset_delta: onasset_liquidity_value.mantissa().try_into().unwrap(),
    });

    let pool = token_data.pools[pool_index];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index: pool_index.try_into().unwrap(),
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
