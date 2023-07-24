use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, onusd_amount: u64)]
pub struct AddLiquidityToComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
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
        constraint = (pool_index as u64) < token_data.load()?.num_pools @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[pool_index as usize].status == Status::Active as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<AddLiquidityToComet>, pool_index: u8, onusd_amount: u64) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let comet = &mut ctx.accounts.user_account.comet;
    let pool = token_data.pools[pool_index as usize];
    let committed_onusd_value = pool.committed_onusd_liquidity.to_decimal();
    let onusd_liquidity_value = Decimal::new(onusd_amount.try_into().unwrap(), CLONE_TOKEN_SCALE);

    let proportion_value = if committed_onusd_value > Decimal::ZERO {
        onusd_liquidity_value / committed_onusd_value
    } else {
        Decimal::ZERO
    };

    let onusd_ild = rescale_toward_zero(
        pool.onusd_ild.to_decimal() * proportion_value,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild = rescale_toward_zero(
        pool.onasset_ild.to_decimal() * proportion_value,
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
        let position = comet.positions[position_index];
        let committed_onusd_liquidity = rescale_toward_zero(
            position.committed_onusd_liquidity.to_decimal() + onusd_liquidity_value,
            CLONE_TOKEN_SCALE,
        );
        let onusd_ild_rebate = rescale_toward_zero(
            position.onusd_ild_rebate.to_decimal() + onusd_ild,
            CLONE_TOKEN_SCALE,
        );
        let onasset_ild_rebate = rescale_toward_zero(
            position.onasset_ild_rebate.to_decimal() + onasset_ild,
            CLONE_TOKEN_SCALE,
        );
        // update comet position data
        comet.positions[position_index].committed_onusd_liquidity =
            RawDecimal::from(committed_onusd_liquidity);
        comet.positions[position_index].onusd_ild_rebate = RawDecimal::from(onusd_ild_rebate);
        comet.positions[position_index].onasset_ild_rebate = RawDecimal::from(onasset_ild_rebate);
    } else {
        comet.add_position(CometPosition {
            pool_index: pool_index as u64,
            committed_onusd_liquidity: RawDecimal::from(onusd_liquidity_value),
            onusd_ild_rebate: RawDecimal::from(onusd_ild),
            onasset_ild_rebate: RawDecimal::from(onasset_ild),
        });
    }

    // Update pool
    let updated_committed_onusd_liquidity = rescale_toward_zero(
        committed_onusd_value + onusd_liquidity_value,
        CLONE_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].committed_onusd_liquidity =
        RawDecimal::from(updated_committed_onusd_liquidity);
    token_data.pools[pool_index as usize].onasset_ild = RawDecimal::from(rescale_toward_zero(
        pool.onasset_ild.to_decimal() + onasset_ild,
        CLONE_TOKEN_SCALE,
    ));
    token_data.pools[pool_index as usize].onusd_ild = RawDecimal::from(rescale_toward_zero(
        pool.onusd_ild.to_decimal() + onusd_ild,
        CLONE_TOKEN_SCALE,
    ));

    let health_score = calculate_health_score(&comet, token_data)?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index,
        committed_onusd_delta: onusd_amount.try_into().unwrap(),
        onusd_ild_delta: onusd_ild.mantissa().try_into().unwrap(),
        onasset_ild_delta: onasset_ild.mantissa().try_into().unwrap(),
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let oracle_price = rescale_toward_zero(oracle.price.to_decimal(), CLONE_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index,
        onasset_ild: pool.onasset_ild.to_decimal().mantissa().try_into().unwrap(),
        onusd_ild: pool.onusd_ild.to_decimal().mantissa().try_into().unwrap(),
        committed_onusd_liquidity: pool
            .committed_onusd_liquidity
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
