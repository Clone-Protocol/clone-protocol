use crate::states::*;
use crate::*;

pub fn check_feed_update(oracle_info: OracleInfo, slot: u64) -> Result<()> {
    if oracle_info.last_update_slot < slot {
        return Err(CloneError::OutdatedOracle.into());
    }
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

pub fn calculate_liquidity_proportion_from_onusd(
    onusd_liquidity_value: Decimal,
    onusd_amm_value: Decimal,
) -> Result<Decimal> {
    Ok(onusd_liquidity_value / (onusd_amm_value + onusd_liquidity_value))
}

pub fn check_mint_collateral_sufficient(
    oracle: OracleInfo,
    asset_amount_borrowed: Decimal,
    collateral_ratio: Decimal,
    collateral_amount: Decimal,
) -> Result<()> {
    let slot = Clock::get().expect("Failed to get slot.").slot;
    if check_feed_update(oracle, slot).is_err() {
        return Err(error!(CloneError::OutdatedOracle));
    }
    if (oracle.get_price() * asset_amount_borrowed * collateral_ratio) > collateral_amount {
        return Err(error!(CloneError::InvalidMintCollateralRatio));
    }
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

pub fn calculate_comet_position_loss(
    token_data: &TokenData,
    comet_position: &CometPosition,
) -> Result<(Decimal, Decimal)> {
    let pool = token_data.pools[comet_position.pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let position_committed_onusd_liquidity =
        to_clone_decimal!(comet_position.committed_onusd_liquidity);
    let total_committed_onusd_liquidity = to_clone_decimal!(pool.committed_onusd_liquidity);

    let proportional_value = if total_committed_onusd_liquidity > Decimal::ZERO {
        position_committed_onusd_liquidity / total_committed_onusd_liquidity
    } else {
        Decimal::ZERO
    };

    let onusd_ild_share = rescale_toward_zero(
        to_clone_decimal!(pool.onusd_ild) * proportional_value
            - to_clone_decimal!(comet_position.onusd_ild_rebate),
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_share = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * proportional_value
            - to_clone_decimal!(comet_position.onasset_ild_rebate),
        CLONE_TOKEN_SCALE,
    );

    let impermanent_loss = onusd_ild_share.max(Decimal::ZERO)
        + oracle.get_price() * onasset_ild_share.max(Decimal::ZERO);

    let impermanent_loss_term =
        impermanent_loss * to_clone_decimal!(pool.asset_info.il_health_score_coefficient);
    let position_term = to_clone_decimal!(comet_position.committed_onusd_liquidity)
        * to_clone_decimal!(pool.asset_info.position_health_score_coefficient);

    Ok((impermanent_loss_term, position_term))
}

pub fn calculate_health_score(comet: &Comet, token_data: &TokenData) -> Result<HealthScore> {
    let slot = Clock::get().expect("Failed to get slot.").slot;

    let mut total_il_term = Decimal::zero();
    let mut total_position_term = Decimal::zero();

    for index in 0..(comet.num_positions as usize) {
        let comet_position = comet.positions[index];
        let pool = token_data.pools[comet_position.pool_index as usize];
        let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];

        if check_feed_update(oracle, slot).is_err() {
            return Err(error!(CloneError::OutdatedOracle));
        }
        let (impermanent_loss_term, position_term) =
            calculate_comet_position_loss(token_data, &comet_position)?;

        total_il_term += impermanent_loss_term;
        total_position_term += position_term;
    }

    let effective_collateral = comet.calculate_effective_collateral_value(token_data);

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

pub fn rescale_toward_zero(decimal: Decimal, scale: u32) -> Decimal {
    let mut rounded_decimal = decimal.round_dp_with_strategy(scale, RoundingStrategy::ToZero);
    rounded_decimal.rescale(scale);
    return rounded_decimal;
}

pub struct ILDShare {
    pub onusd_ild_claim: Decimal,
    pub onasset_ild_claim: Decimal,
    pub onusd_ild_share: Decimal,
    pub onasset_ild_share: Decimal,
}

pub fn calculate_ild_share(comet_position: &CometPosition, token_data: &TokenData) -> ILDShare {
    let pool_index = comet_position.pool_index as usize;
    let pool = token_data.pools[pool_index];
    let position_committed_onusd_liquidity =
        to_clone_decimal!(comet_position.committed_onusd_liquidity);
    let total_committed_onusd_liquidity = to_clone_decimal!(pool.committed_onusd_liquidity);

    let claimable_ratio = if total_committed_onusd_liquidity > Decimal::ZERO {
        position_committed_onusd_liquidity / total_committed_onusd_liquidity
    } else {
        Decimal::ZERO
    };

    let onusd_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.onusd_ild) * claimable_ratio,
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_claim = rescale_toward_zero(
        to_clone_decimal!(pool.onasset_ild) * claimable_ratio,
        CLONE_TOKEN_SCALE,
    );

    let onusd_ild_share = rescale_toward_zero(
        onusd_ild_claim - to_clone_decimal!(comet_position.onusd_ild_rebate),
        CLONE_TOKEN_SCALE,
    );
    let onasset_ild_share = rescale_toward_zero(
        onasset_ild_claim - to_clone_decimal!(comet_position.onasset_ild_rebate),
        CLONE_TOKEN_SCALE,
    );

    ILDShare {
        onusd_ild_claim,
        onasset_ild_claim,
        onusd_ild_share,
        onasset_ild_share,
    }
}
