use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::error::*;
use crate::events::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{to_clone_decimal, CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, collateral_amount: u64)]
pub struct WithdrawLiquidityFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (comet_position_index as usize) < user_account.comet.positions.len() @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: Box<Account<'info, User>>,
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
        constraint = pools.pools[user_account.comet.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen @ CloneError::StatusPreventsAction
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
}

pub fn withdraw_liquidity(
    pools: &mut Pools,
    oracles: &Oracles,
    comet: &mut Comet,
    comet_position_index: u8,
    collateral_amount: u64,
    user: Pubkey,
    event_counter: u64,
) -> Result<()> {
    return_error_if_false!(collateral_amount > 0, CloneError::InvalidTokenAmount);
    let comet_position = comet.positions[comet_position_index as usize];
    let pool_index = comet_position.pool_index;
    let pool = &pools.pools[pool_index as usize];
    return_error_if_false!(
        comet_position.committed_collateral_liquidity > 0,
        CloneError::NoLiquidityToWithdraw
    );

    return_error_if_false!(
        pool.committed_collateral_liquidity > 0,
        CloneError::PoolEmpty
    );

    let collateral_value_to_withdraw =
        collateral_amount.min(comet_position.committed_collateral_liquidity);

    let proportional_value = to_clone_decimal!(collateral_value_to_withdraw)
        / to_clone_decimal!(pool.committed_collateral_liquidity);

    let collateral_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.collateral_ild) * proportional_value,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * proportional_value,
        CLONE_TOKEN_SCALE,
    );

    // Update pool values:
    pools.pools[pool_index as usize].onasset_ild -= onasset_ild_claim.mantissa() as i64;
    pools.pools[pool_index as usize].collateral_ild -= collateral_ild_claim.mantissa() as i64;
    pools.pools[pool_index as usize].committed_collateral_liquidity -= collateral_value_to_withdraw;
    // Update position values:
    comet.positions[comet_position_index as usize].onasset_ild_rebate -=
        onasset_ild_claim.mantissa() as i64;
    comet.positions[comet_position_index as usize].collateral_ild_rebate -=
        collateral_ild_claim.mantissa() as i64;
    comet.positions[comet_position_index as usize].committed_collateral_liquidity -=
        collateral_value_to_withdraw;

    emit!(LiquidityDelta {
        event_id: event_counter,
        user_address: user,
        pool_index: pool_index.try_into().unwrap(),
        committed_collateral_delta: -(collateral_value_to_withdraw as i64),
        onasset_ild_delta: -(onasset_ild_claim.mantissa() as i64),
        collateral_ild_delta: -(collateral_ild_claim.mantissa() as i64)
    });

    let pool = &pools.pools[pool_index as usize];
    let oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let oracle_price = rescale_toward_zero(oracle.get_price(), CLONE_TOKEN_SCALE);

    emit!(PoolState {
        event_id: event_counter,
        pool_index: pool_index.try_into().unwrap(),
        onasset_ild: pool.onasset_ild,
        collateral_ild: pool.collateral_ild,
        committed_collateral_liquidity: pool.committed_collateral_liquidity,
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    Ok(())
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromComet>,
    comet_position_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;
    let comet = &mut ctx.accounts.user_account.comet;
    withdraw_liquidity(
        pools,
        oracles,
        comet,
        comet_position_index,
        collateral_amount,
        ctx.accounts.user.key(),
        ctx.accounts.clone.event_counter,
    )?;
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
