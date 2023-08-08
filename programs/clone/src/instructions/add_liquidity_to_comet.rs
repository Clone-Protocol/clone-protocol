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
    pub user_account: AccountLoader<'info, User>,
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
        constraint = (pool_index as usize) < pools.pools.len() @ CloneError::InvalidInputPositionIndex,
        constraint = pools.pools[pool_index as usize].status == Status::Active @ CloneError::StatusPreventsAction
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
    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;
    let comet: &mut Comet = &mut ctx.accounts.user_account.load_mut()?.comet;
    let pool = &pools.pools[pool_index as usize];
    let committed_collateral_value = to_clone_decimal!(pool.committed_collateral_liquidity);
    let collateral_liquidity_value = to_clone_decimal!(collateral_amount);

    let proportion_value = if committed_collateral_value > Decimal::ZERO {
        collateral_liquidity_value / committed_collateral_value
    } else {
        Decimal::ZERO
    };

    let collateral_ild = rescale_toward_zero(
        to_clone_decimal!(pool.collateral_ild) * proportion_value,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * proportion_value,
        CLONE_TOKEN_SCALE,
    );

    // find the index of the position within the comet position
    let mut comet_position_index: Option<usize> = None;
    for (i, pos) in comet.positions[..comet.num_positions as usize]
        .iter()
        .enumerate()
    {
        if pos.pool_index == (pool_index as u64) {
            comet_position_index = Some(i);
            break;
        }
    }

    // check to see if a new position must be added to the position
    if let Some(position_index) = comet_position_index {
        // update comet position data
        comet.positions[position_index].committed_collateral_liquidity += collateral_amount;
        comet.positions[position_index].collateral_ild_rebate += collateral_ild.mantissa() as i64;
        comet.positions[position_index].onasset_ild_rebate += onasset_ild.mantissa() as i64;
    } else {
        comet.add_position(CometPosition {
            pool_index: pool_index as u64,
            committed_collateral_liquidity: collateral_liquidity_value
                .mantissa()
                .try_into()
                .unwrap(),
            collateral_ild_rebate: collateral_ild.mantissa().try_into().unwrap(),
            onasset_ild_rebate: onasset_ild.mantissa().try_into().unwrap(),
        });
    }

    // Update pool
    pools.pools[pool_index as usize].committed_collateral_liquidity += collateral_amount;
    pools.pools[pool_index as usize].onasset_ild += onasset_ild.mantissa() as i64;
    pools.pools[pool_index as usize].collateral_ild += collateral_ild.mantissa() as i64;

    let health_score = calculate_health_score(comet, pools, oracles, collateral)?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index,
        committed_collateral_delta: collateral_amount.try_into().unwrap(),
        collateral_ild_delta: collateral_ild.mantissa().try_into().unwrap(),
        onasset_ild_delta: onasset_ild.mantissa().try_into().unwrap(),
    });

    let pool = &pools.pools[pool_index as usize];
    let oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let oracle_price = rescale_toward_zero(oracle.get_price(), CLONE_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index,
        onasset_ild: pool.onasset_ild,
        collateral_ild: pool.collateral_ild,
        committed_collateral_liquidity: pool.committed_collateral_liquidity,
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
