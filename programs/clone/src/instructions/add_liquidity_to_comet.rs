use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, onusd_amount: u64)]
pub struct AddLiquidityToComet<'info> {
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
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[pool_index as usize].deprecated == 0 @ CloneError::PoolDeprecated
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.comet,
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<AddLiquidityToComet>, pool_index: u8, onusd_amount: u64) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let pool = token_data.pools[pool_index as usize];
    let committed_onusd_value = pool.committed_onusd_liquidity.to_decimal();
    let onusd_liquidity_value = Decimal::new(onusd_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let proportion_value = onusd_liquidity_value / committed_onusd_value;
    let onusd_ild = rescale_toward_zero(
        pool.onusd_ild.to_decimal() * proportion_value,
        DEVNET_TOKEN_SCALE,
    );
    let onasset_ild = rescale_toward_zero(
        pool.onasset_ild.to_decimal() * proportion_value,
        DEVNET_TOKEN_SCALE,
    );

    // find the index of the position within the comet position
    let comet_position_index = comet.get_pool_index(pool_index);

    // check to see if a new position must be added to the position
    if comet_position_index == usize::MAX {
        comet.add_position(CometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            pool_index: pool_index as u64,
            committed_onusd_liquidity: RawDecimal::from(onusd_liquidity_value),
            onusd_ild_rebate: RawDecimal::from(onusd_ild),
            onasset_ild_rebate: RawDecimal::from(onasset_ild),
        });
    } else {
        let position = comet.positions[comet_position_index];
        let committed_onusd_liquidity = rescale_toward_zero(
            position.committed_onusd_liquidity.to_decimal() + onusd_liquidity_value,
            DEVNET_TOKEN_SCALE,
        );
        let onusd_ild_rebate = rescale_toward_zero(
            position.onusd_ild_rebate.to_decimal() + onusd_ild,
            DEVNET_TOKEN_SCALE,
        );
        let onasset_ild_rebate = rescale_toward_zero(
            position.onasset_ild_rebate.to_decimal() + onasset_ild,
            DEVNET_TOKEN_SCALE,
        );
        // update comet position data
        comet.positions[comet_position_index].committed_onusd_liquidity =
            RawDecimal::from(committed_onusd_liquidity);
        comet.positions[comet_position_index].onusd_ild_rebate = RawDecimal::from(onusd_ild_rebate);
        comet.positions[comet_position_index].onasset_ild_rebate =
            RawDecimal::from(onasset_ild_rebate);
    }

    // Update pool
    token_data.pools[pool_index as usize].committed_onusd_liquidity =
        RawDecimal::from(rescale_toward_zero(
            committed_onusd_value + onusd_liquidity_value,
            DEVNET_TOKEN_SCALE,
        ));
    token_data.pools[pool_index as usize].onasset_ild = RawDecimal::from(rescale_toward_zero(
        pool.onasset_ild.to_decimal() + onasset_ild,
        DEVNET_TOKEN_SCALE,
    ));
    token_data.pools[pool_index as usize].onusd_ild = RawDecimal::from(rescale_toward_zero(
        pool.onusd_ild.to_decimal() + onusd_ild,
        DEVNET_TOKEN_SCALE,
    ));

    let health_score = calculate_health_score(&comet, token_data)?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user: ctx.accounts.user.key(),
        pool_index,
        committed_onusd_delta: onusd_amount.try_into().unwrap(),
        onusd_ild_delta: onusd_ild.mantissa().try_into().unwrap(),
        onasset_ild_delta: onasset_ild.mantissa().try_into().unwrap(),
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

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
