use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawLiquidityFromComet<'info> {
    #[account(address = comet.load()?.owner)]
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
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet,
        constraint = (comet_position_index as u64) < comet.load()?.num_positions @ CloneError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
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
    let position_committed_onusd = comet_position.committed_onusd_liquidity.to_decimal();
    return_error_if_false!(
        position_committed_onusd > Decimal::ZERO,
        CloneError::NoLiquidityToWithdraw
    );
    let total_committed_onusd_liquidity = pool.committed_onusd_liquidity.to_decimal();

    return_error_if_false!(
        total_committed_onusd_liquidity > Decimal::ZERO,
        CloneError::PoolEmpty
    );

    let onusd_value_to_withdraw = Decimal::new(onusd_amount.try_into().unwrap(), CLONE_TOKEN_SCALE)
        .min(position_committed_onusd);

    let proportional_value = onusd_value_to_withdraw / total_committed_onusd_liquidity;

    let onusd_ild_claim = rescale_toward_zero(
        pool.onusd_ild.to_decimal() * proportional_value,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_claim = rescale_toward_zero(
        pool.onasset_ild.to_decimal() * proportional_value,
        CLONE_TOKEN_SCALE,
    );

    // Update pool values:
    token_data.pools[pool_index as usize].onasset_ild = RawDecimal::from(rescale_toward_zero(
        pool.onasset_ild.to_decimal() - onasset_ild_claim,
        CLONE_TOKEN_SCALE,
    ));
    token_data.pools[pool_index as usize].onusd_ild = RawDecimal::from(rescale_toward_zero(
        pool.onusd_ild.to_decimal() - onusd_ild_claim,
        CLONE_TOKEN_SCALE,
    ));
    token_data.pools[pool_index as usize].committed_onusd_liquidity =
        RawDecimal::from(rescale_toward_zero(
            total_committed_onusd_liquidity - onusd_value_to_withdraw,
            CLONE_TOKEN_SCALE,
        ));
    // Update position values:
    comet.positions[comet_position_index as usize].onasset_ild_rebate =
        RawDecimal::from(rescale_toward_zero(
            comet_position.onasset_ild_rebate.to_decimal() - onasset_ild_claim,
            CLONE_TOKEN_SCALE,
        ));
    comet.positions[comet_position_index as usize].onusd_ild_rebate =
        RawDecimal::from(rescale_toward_zero(
            comet_position.onusd_ild_rebate.to_decimal() - onusd_ild_claim,
            CLONE_TOKEN_SCALE,
        ));
    comet.positions[comet_position_index as usize].committed_onusd_liquidity =
        RawDecimal::from(rescale_toward_zero(
            comet_position.committed_onusd_liquidity.to_decimal() - onusd_value_to_withdraw,
            CLONE_TOKEN_SCALE,
        ));

    emit!(LiquidityDelta {
        event_id: event_counter,
        user_address: user,
        pool_index: pool_index.try_into().unwrap(),
        committed_onusd_delta: -(onusd_value_to_withdraw.mantissa() as i64),
        onasset_ild_delta: -(onasset_ild_claim.mantissa() as i64),
        onusd_ild_delta: -(onusd_ild_claim.mantissa() as i64)
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let oracle_price = rescale_toward_zero(oracle.price.to_decimal(), CLONE_TOKEN_SCALE);

    emit!(PoolState {
        event_id: event_counter,
        pool_index: pool_index.try_into().unwrap(),
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

    Ok(())
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromComet>,
    comet_position_index: u8,
    onusd_amount: u64,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let comet = &mut ctx.accounts.comet.load_mut()?;
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
