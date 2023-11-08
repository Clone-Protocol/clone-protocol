use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::{return_error_if_false, to_clone_decimal};
use crate::{CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, collateral_amount: u64)]
pub struct AddLiquidityToComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
}

pub fn execute(
    ctx: Context<AddLiquidityToComet>,
    pool_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    return_error_if_false!(collateral_amount > 0, CloneError::InvalidTokenAmount);

    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    return_error_if_false!(
        pools.pools[pool_index as usize].status == Status::Active,
        CloneError::StatusPreventsAction
    );
    let oracles = &ctx.accounts.oracles;
    let comet = &mut ctx.accounts.user_account.comet;
    let pool = &pools.pools[pool_index as usize];
    let committed_collateral_value =
        collateral.to_collateral_decimal(pool.committed_collateral_liquidity)?;
    let collateral_liquidity_value = collateral.to_collateral_decimal(collateral_amount)?;

    let proportion_value = if committed_collateral_value > Decimal::ZERO {
        collateral_liquidity_value
            .checked_div(committed_collateral_value)
            .ok_or(error!(CloneError::CheckedMathError))?
    } else {
        Decimal::ZERO
    };

    let collateral_ild = rescale_toward_zero(
        collateral
            .to_collateral_decimal(pool.collateral_ild)?
            .checked_mul(proportion_value)
            .ok_or(error!(CloneError::CheckedMathError))?,
        collateral
            .scale
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
    );
    let collateral_ild_delta: i64 = collateral_ild
        .mantissa()
        .try_into()
        .map_err(|_| CloneError::IntTypeConversionError)?;
    let onasset_ild = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild)
            .checked_mul(proportion_value)
            .ok_or(error!(CloneError::CheckedMathError))?,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_delta: i64 = onasset_ild
        .mantissa()
        .try_into()
        .map_err(|_| CloneError::IntTypeConversionError)?;

    // find the index of the position within the comet position
    if let Some((position_index, _)) = comet
        .positions
        .iter()
        .enumerate()
        .find(|(_, position)| position.pool_index == pool_index)
    {
        comet.positions[position_index].committed_collateral_liquidity = comet.positions
            [position_index]
            .committed_collateral_liquidity
            .checked_add(collateral_amount)
            .ok_or(error!(CloneError::CheckedMathError))?;
        comet.positions[position_index].collateral_ild_rebate = comet.positions[position_index]
            .collateral_ild_rebate
            .checked_add(collateral_ild_delta)
            .ok_or(error!(CloneError::CheckedMathError))?;
        comet.positions[position_index].onasset_ild_rebate = comet.positions[position_index]
            .onasset_ild_rebate
            .checked_add(onasset_ild_delta)
            .ok_or(error!(CloneError::CheckedMathError))?;
    } else {
        comet.positions.push(LiquidityPosition {
            pool_index,
            committed_collateral_liquidity: collateral_amount,
            collateral_ild_rebate: collateral_ild_delta,
            onasset_ild_rebate: onasset_ild_delta,
        });
    }

    // Update pool
    pools.pools[pool_index as usize].committed_collateral_liquidity = pools.pools
        [pool_index as usize]
        .committed_collateral_liquidity
        .checked_add(collateral_amount)
        .ok_or(error!(CloneError::CheckedMathError))?;
    pools.pools[pool_index as usize].onasset_ild = pools.pools[pool_index as usize]
        .onasset_ild
        .checked_add(onasset_ild_delta)
        .ok_or(error!(CloneError::CheckedMathError))?;
    pools.pools[pool_index as usize].collateral_ild = pools.pools[pool_index as usize]
        .collateral_ild
        .checked_add(collateral_ild_delta)
        .ok_or(error!(CloneError::CheckedMathError))?;

    let health_score = calculate_health_score(comet, pools, oracles, collateral)?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index,
        committed_collateral_delta: collateral_amount
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
        collateral_ild_delta,
        onasset_ild_delta,
    });

    let pool = &pools.pools[pool_index as usize];
    let oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_oracle = &oracles.oracles[collateral.oracle_info_index as usize];
    let pool_price = rescale_toward_zero(
        oracle
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
