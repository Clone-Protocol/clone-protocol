use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::error::*;
use crate::events::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{to_clone_decimal, CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, onusd_amount: u64)]
pub struct WithdrawLiquidityFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (comet_position_index as u64) < user_account.load()?.comet.num_positions @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[user_account.load()?.comet.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn withdraw_liquidity(
    token_data: &mut TokenData,
    comet: &mut Comet,
    comet_position_index: u8,
    onusd_amount: u64,
    user: Pubkey,
    event_counter: u64,
) -> Result<()> {
    let comet_position = comet.positions[comet_position_index as usize];
    let pool_index = comet_position.pool_index;
    let pool = token_data.pools[pool_index as usize];
    return_error_if_false!(
        comet_position.committed_onusd_liquidity > 0,
        CloneError::NoLiquidityToWithdraw
    );

    return_error_if_false!(pool.committed_onusd_liquidity > 0, CloneError::PoolEmpty);

    let onusd_value_to_withdraw = onusd_amount.min(comet_position.committed_onusd_liquidity);

    let proportional_value = to_clone_decimal!(onusd_value_to_withdraw)
        / to_clone_decimal!(pool.committed_onusd_liquidity);

    let onusd_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.onusd_ild) * proportional_value,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * proportional_value,
        CLONE_TOKEN_SCALE,
    );

    // Update pool values:
    token_data.pools[pool_index as usize].onasset_ild -= onasset_ild_claim.mantissa() as i64;
    token_data.pools[pool_index as usize].onusd_ild -= onusd_ild_claim.mantissa() as i64;
    token_data.pools[pool_index as usize].committed_onusd_liquidity -= onusd_value_to_withdraw;
    // Update position values:
    comet.positions[comet_position_index as usize].onasset_ild_rebate -=
        onasset_ild_claim.mantissa() as i64;
    comet.positions[comet_position_index as usize].onusd_ild_rebate -=
        onusd_ild_claim.mantissa() as i64;
    comet.positions[comet_position_index as usize].committed_onusd_liquidity -=
        onusd_value_to_withdraw;

    emit!(LiquidityDelta {
        event_id: event_counter,
        user_address: user,
        pool_index: pool_index.try_into().unwrap(),
        committed_onusd_delta: -(onusd_value_to_withdraw as i64),
        onasset_ild_delta: -(onasset_ild_claim.mantissa() as i64),
        onusd_ild_delta: -(onusd_ild_claim.mantissa() as i64)
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let oracle_price = rescale_toward_zero(oracle.get_price(), CLONE_TOKEN_SCALE);

    emit!(PoolState {
        event_id: event_counter,
        pool_index: pool_index.try_into().unwrap(),
        onasset_ild: pool.onasset_ild,
        onusd_ild: pool.onusd_ild,
        committed_onusd_liquidity: pool.committed_onusd_liquidity,
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    Ok(())
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromComet>,
    comet_position_index: u8,
    onusd_amount: u64,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let comet = &mut ctx.accounts.user_account.load_mut()?.comet;
    withdraw_liquidity(
        token_data,
        comet,
        comet_position_index,
        onusd_amount,
        ctx.accounts.user.key(),
        ctx.accounts.clone.event_counter,
    )?;
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
