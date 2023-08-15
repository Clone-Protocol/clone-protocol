use std::convert::TryInto;

use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::{error::*, to_ratio_decimal};
use crate::{return_error_if_false, to_clone_decimal};
use crate::{states::*, to_pct_decimal};
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;

pub fn check_feed_update(oracle_info: &OracleInfo, slot: u64) -> Result<()> {
    return_error_if_false!(
        oracle_info.last_update_slot == slot,
        CloneError::OutdatedOracle
    );
    Ok(())
}

pub fn calculate_liquidity_proportion_from_committed_usd(
    position_committed_usd: Decimal,
    total_committed_usd: Decimal,
) -> Decimal {
    if total_committed_usd > Decimal::ZERO {
        position_committed_usd / total_committed_usd
    } else {
        Decimal::ZERO
    }
}

pub fn calculate_liquidity_proportion_from_collateral(
    collateral_liquidity_value: Decimal,
    collateral_amm_value: Decimal,
) -> Result<Decimal> {
    Ok(collateral_liquidity_value / (collateral_amm_value + collateral_liquidity_value))
}

pub fn check_mint_collateral_sufficient(
    pool_oracle: &OracleInfo,
    collateral_oracle: &OracleInfo,
    asset_amount_borrowed: Decimal,
    min_overcollateral_ratio: Decimal,
    collateralization_ratio: Decimal,
    collateral_amount: Decimal,
) -> Result<()> {
    let slot = Clock::get().expect("Failed to get slot.").slot;
    check_feed_update(pool_oracle, slot)?;
    check_feed_update(collateral_oracle, slot)?;
    let pool_price = pool_oracle.get_price() / collateral_oracle.get_price();

    return_error_if_false!(
        (asset_amount_borrowed == Decimal::ZERO)
            || (collateral_amount * collateralization_ratio) / (pool_price * asset_amount_borrowed)
                >= min_overcollateral_ratio,
        CloneError::InvalidMintCollateralRatio
    );

    Ok(())
}

#[derive(Clone, Debug)]
pub struct HealthScore {
    pub score: Decimal,
    pub effective_collateral: Decimal,
    pub total_il_term: Decimal,
    pub total_position_term: Decimal,
}

impl HealthScore {
    pub fn is_healthy(&self) -> bool {
        self.score.is_sign_positive()
    }
}

pub fn calculate_liquidity_position_loss(
    pools: &Pools,
    oracles: &Oracles,
    liquidity_position: &LiquidityPosition,
    collateral: &Collateral,
) -> Result<(Decimal, Decimal)> {
    let pool = &&pools.pools[liquidity_position.pool_index as usize];
    let oracle = &&oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_oracle = &&oracles.oracles[collateral.oracle_info_index as usize];

    let position_committed_collateral_liquidity =
        collateral.to_collateral_decimal(liquidity_position.committed_collateral_liquidity)?;
    let total_committed_collateral_liquidity =
        collateral.to_collateral_decimal(pool.committed_collateral_liquidity)?;

    let proportional_value = if total_committed_collateral_liquidity > Decimal::ZERO {
        position_committed_collateral_liquidity / total_committed_collateral_liquidity
    } else {
        Decimal::ZERO
    };

    let collateral_ild_share = rescale_toward_zero(
        collateral.to_collateral_decimal(pool.collateral_ild)? * proportional_value
            - collateral.to_collateral_decimal(liquidity_position.collateral_ild_rebate)?,
        collateral.scale.try_into().unwrap(),
    );
    let onasset_ild_share = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * proportional_value
            - to_clone_decimal!(liquidity_position.onasset_ild_rebate),
        CLONE_TOKEN_SCALE,
    );

    let pool_price = oracle.get_price() / collateral_oracle.get_price();

    let impermanent_loss =
        collateral_ild_share.max(Decimal::ZERO) + pool_price * onasset_ild_share.max(Decimal::ZERO);

    let impermanent_loss_term =
        impermanent_loss * to_pct_decimal!(pool.asset_info.il_health_score_coefficient);
    let position_term = collateral
        .to_collateral_decimal(liquidity_position.committed_collateral_liquidity)?
        * to_pct_decimal!(pool.asset_info.position_health_score_coefficient);

    Ok((impermanent_loss_term, position_term))
}

pub fn calculate_health_score(
    comet: &Comet,
    pools: &Pools,
    oracles: &Oracles,
    collateral: &Collateral,
) -> Result<HealthScore> {
    let slot = Clock::get().expect("Failed to get slot.").slot;
    let collateral_oracle = &oracles.oracles[collateral.oracle_info_index as usize];
    check_feed_update(collateral_oracle, slot)?;

    let mut total_il_term = Decimal::zero();
    let mut total_position_term = Decimal::zero();

    for index in 0..(comet.positions.len() as usize) {
        let liquidity_position = comet.positions[index];
        let pool = &&pools.pools[liquidity_position.pool_index as usize];
        let oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];

        check_feed_update(oracle, slot)?;
        let (impermanent_loss_term, position_term) =
            calculate_liquidity_position_loss(pools, oracles, &liquidity_position, collateral)?;

        total_il_term += impermanent_loss_term;
        total_position_term += position_term;
    }

    let effective_collateral = collateral.to_collateral_decimal(comet.collateral_amount)?
        * to_ratio_decimal!(collateral.collateralization_ratio);

    let score = if total_il_term.is_zero() && total_position_term.is_zero() {
        Decimal::new(100, 0)
    } else {
        Decimal::new(100, 0) - (total_il_term + total_position_term) / effective_collateral
    };

    Ok(HealthScore {
        score,
        effective_collateral,
        total_il_term,
        total_position_term,
    })
}

pub struct ILDShare {
    pub collateral_ild_claim: Decimal,
    pub onasset_ild_claim: Decimal,
    pub collateral_ild_share: Decimal,
    pub onasset_ild_share: Decimal,
}

pub fn calculate_ild_share(
    liquidity_position: &LiquidityPosition,
    pools: &Pools,
    collateral: &Collateral,
) -> ILDShare {
    let pool_index = liquidity_position.pool_index as usize;
    let pool = &pools.pools[pool_index];
    let position_committed_collateral_liquidity = collateral
        .to_collateral_decimal(liquidity_position.committed_collateral_liquidity)
        .unwrap();
    let total_committed_collateral_liquidity = collateral
        .to_collateral_decimal(pool.committed_collateral_liquidity)
        .unwrap();

    let claimable_ratio = if total_committed_collateral_liquidity > Decimal::ZERO {
        position_committed_collateral_liquidity / total_committed_collateral_liquidity
    } else {
        Decimal::ZERO
    };

    let collateral_ild_claim = rescale_toward_zero(
        collateral
            .to_collateral_decimal(pool.collateral_ild)
            .unwrap()
            * claimable_ratio,
        collateral.scale.try_into().unwrap(),
    );
    let onasset_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * claimable_ratio,
        CLONE_TOKEN_SCALE,
    );

    let collateral_ild_share = rescale_toward_zero(
        collateral_ild_claim
            - collateral
                .to_collateral_decimal(liquidity_position.collateral_ild_rebate)
                .unwrap(),
        collateral.scale.try_into().unwrap(),
    );
    let onasset_ild_share = rescale_toward_zero(
        onasset_ild_claim - to_clone_decimal!(liquidity_position.onasset_ild_rebate),
        CLONE_TOKEN_SCALE,
    );

    ILDShare {
        collateral_ild_claim,
        onasset_ild_claim,
        collateral_ild_share,
        onasset_ild_share,
    }
}
