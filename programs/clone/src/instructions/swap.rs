use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::to_bps_decimal;
use crate::{error::*, update_prices};
use crate::{
    return_error_if_false, to_clone_decimal, CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use clone_staking::{
    program::CloneStaking as CloneStakingProgram,
    states::{CloneStaking, User as UserStaking},
    CLONE_STAKING_SEED, USER_SEED as USER_STAKING_SEED,
};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(
    pool_index: u8,
    quantity: u64,
    quantity_is_input: bool,
    quantity_is_collateral: bool,
    result_threshold: u64
)]
pub struct Swap<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = (pool_index as usize) < pools.pools.len() @ CloneError::InvalidInputPositionIndex,
        constraint = pools.pools[pool_index as usize].status == Status::Active @ CloneError::StatusPreventsAction,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = pools.pools[pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        address = clone.collateral.mint
    )]
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = clone.collateral.vault
    )]
    pub collateral_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_collateral_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    #[account(
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump,
        seeds::program = clone_staking_program.clone().ok_or(error!(CloneError::ExpectedAccountNotFound))?.key(),
    )]
    pub clone_staking: Option<Account<'info, CloneStaking>>,
    #[account(
        seeds = [USER_STAKING_SEED.as_ref(), user.key.as_ref()],
        bump,
        seeds::program = clone_staking_program.clone().ok_or(error!(CloneError::ExpectedAccountNotFound))?.key(),
    )]
    pub user_staking_account: Option<Account<'info, UserStaking>>,
    pub clone_staking_program: Option<Program<'info, CloneStakingProgram>>,
}

pub fn execute(
    ctx: Context<Swap>,
    pool_index: u8,
    quantity: u64,
    quantity_is_input: bool,
    quantity_is_collateral: bool,
    result_threshold: u64,
) -> Result<()> {
    return_error_if_false!(quantity > 0, CloneError::InvalidTokenAmount);

    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let pool = &pools.pools[pool_index as usize];

    let mut override_liquidity_trading_fee = None;
    let mut override_treasury_trading_fee = None;

    if ctx.accounts.clone_staking.is_some()
        && ctx.accounts.user_staking_account.is_some()
        && ctx.accounts.clone_staking_program.is_some()
    {
        let user_staking_account = ctx
            .accounts
            .user_staking_account
            .as_ref()
            .ok_or(error!(CloneError::ExpectedAccountNotFound))?;
        let clone_staking = ctx
            .accounts
            .clone_staking
            .as_ref()
            .ok_or(error!(CloneError::ExpectedAccountNotFound))?;
        if let Some((lp_fees, treasury_fees)) =
            clone_staking.get_tier_fees(user_staking_account.staked_tokens)
        {
            override_liquidity_trading_fee = Some(to_bps_decimal!(lp_fees));
            override_treasury_trading_fee = Some(to_bps_decimal!(treasury_fees));
        }
    }

    if ctx.remaining_accounts.len() >= 2 {
        let oracle_indices = vec![
            collateral.oracle_info_index,
            pool.asset_info.oracle_info_index,
        ];
        update_prices::update_oracles(
            &mut ctx.accounts.oracles,
            oracle_indices,
            &ctx.remaining_accounts,
        )?;
    }

    let pool_oracle = &ctx.accounts.oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_oracle = &ctx.accounts.oracles.oracles[collateral.oracle_info_index as usize];

    check_feed_update(&pool_oracle, Clock::get()?.slot)?;
    check_feed_update(&collateral_oracle, Clock::get()?.slot)?;

    return_error_if_false!(
        pool.committed_collateral_liquidity > 0,
        CloneError::PoolEmpty
    );
    let user_specified_quantity = if quantity_is_collateral {
        collateral.to_collateral_decimal(quantity)?
    } else {
        to_clone_decimal!(quantity)
    };

    let swap_summary = pool.calculate_swap(
        pool_oracle.get_price()?,
        collateral_oracle.get_price()?,
        user_specified_quantity,
        quantity_is_input,
        quantity_is_collateral,
        collateral,
        override_liquidity_trading_fee,
        override_treasury_trading_fee,
    )?;

    return_error_if_false!(
        user_specified_quantity > Decimal::ZERO
            && swap_summary.result > Decimal::ZERO
            && swap_summary.liquidity_fees_paid > Decimal::ZERO
            && swap_summary.treasury_fees_paid > Decimal::ZERO,
        CloneError::InvalidTokenAmount
    );

    let treasury_fees: u64 = swap_summary
        .treasury_fees_paid
        .mantissa()
        .try_into()
        .map_err(|_| CloneError::IntTypeConversionError)?;
    let result_amount: u64 = swap_summary
        .result
        .mantissa()
        .try_into()
        .map_err(|_| CloneError::IntTypeConversionError)?;
    let mut input_is_collateral = false;

    let (onasset_ild_delta, collateral_ild_delta) = if (quantity_is_input && quantity_is_collateral)
        || (!quantity_is_input && !quantity_is_collateral)
    {
        input_is_collateral = true;
        // User transfers collateral to vault, mint onasset to user, mint onasset as fees
        let (transfer_amount, mint_amount) = if quantity_is_input {
            (quantity, result_amount)
        } else {
            (result_amount, quantity)
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                Transfer {
                    from: ctx
                        .accounts
                        .user_collateral_token_account
                        .to_account_info()
                        .clone(),
                    to: ctx.accounts.collateral_vault.to_account_info().clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                },
            ),
            transfer_amount,
        )?;
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_onasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.clone.to_account_info().clone(),
                },
                seeds,
            ),
            mint_amount,
        )?;
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .treasury_onasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.clone.to_account_info().clone(),
                },
                seeds,
            ),
            treasury_fees,
        )?;

        (
            (mint_amount
                .checked_add(treasury_fees)
                .ok_or(error!(CloneError::CheckedMathError))?)
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
            -(TryInto::<i64>::try_into(transfer_amount)
                .map_err(|_| CloneError::IntTypeConversionError)?),
        )
    } else {
        // User burns onasset, transfer collateral from vault to user, transfer collateral as fees.
        let (burn_amount, transfer_amount) = if quantity_is_input {
            (quantity, result_amount)
        } else {
            (result_amount, quantity)
        };
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                Burn {
                    mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .user_onasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                },
            ),
            burn_amount,
        )?;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Transfer {
                    from: ctx.accounts.collateral_vault.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_collateral_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.clone.to_account_info().clone(),
                },
                seeds,
            ),
            transfer_amount,
        )?;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Transfer {
                    from: ctx.accounts.collateral_vault.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .treasury_collateral_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.clone.to_account_info().clone(),
                },
                seeds,
            ),
            treasury_fees,
        )?;
        (
            -(TryInto::<i64>::try_into(burn_amount)
                .map_err(|_| CloneError::IntTypeConversionError)?),
            (transfer_amount
                .checked_add(treasury_fees)
                .ok_or(error!(CloneError::CheckedMathError))?
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?),
        )
    };

    pools.pools[pool_index as usize].onasset_ild = pools.pools[pool_index as usize]
        .onasset_ild
        .checked_add(onasset_ild_delta)
        .ok_or(error!(CloneError::CheckedMathError))?;
    pools.pools[pool_index as usize].collateral_ild = pools.pools[pool_index as usize]
        .collateral_ild
        .checked_add(collateral_ild_delta)
        .ok_or(error!(CloneError::CheckedMathError))?;

    let (input, output) = if quantity_is_input {
        return_error_if_false!(
            result_amount >= result_threshold,
            CloneError::SlippageToleranceExceeded
        );
        (quantity, result_amount)
    } else {
        return_error_if_false!(
            result_amount <= result_threshold,
            CloneError::SlippageToleranceExceeded
        );
        (result_amount, quantity)
    };

    emit!(SwapEvent {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index,
        input_is_collateral,
        input,
        output,
        trading_fee: swap_summary
            .liquidity_fees_paid
            .mantissa()
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
        treasury_fee: treasury_fees
    });

    let pool = &pools.pools[pool_index as usize];
    let pool_price = rescale_toward_zero(
        pool_oracle
            .get_price()?
            .checked_div(collateral_oracle.get_price()?)
            .ok_or(error!(CloneError::CheckedMathError))?,
        CLONE_TOKEN_SCALE,
    );

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index,
        onasset_ild: pool.onasset_ild,
        collateral_ild: pool.collateral_ild,
        committed_collateral_liquidity: pool.committed_collateral_liquidity,
        pool_price: pool_price
            .mantissa()
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
        pool_scale: pool_price.scale()
    });
    ctx.accounts.clone.event_counter = ctx
        .accounts
        .clone
        .event_counter
        .checked_add(1)
        .ok_or(error!(CloneError::CheckedMathError))?;

    Ok(())
}
