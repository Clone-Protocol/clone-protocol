use crate::states::*;
use crate::*;

pub fn check_feed_update(asset_info: AssetInfo, slot: u64) -> Result<()> {
    if asset_info.last_update < slot {
        return Err(CloneError::OutdatedOracle.into());
    }
    Ok(())
}

pub fn calculate_liquidity_provider_values_from_onasset(
    onasset_liquidity_value: Decimal,
    onasset_amm_value: Decimal,
    onusd_amm_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Result<(Decimal, Decimal)> {
    let onusd_liquidity_value: Decimal;
    let liquidity_tokens_value: Decimal;
    // check to see if the market is empty
    if onasset_amm_value.is_zero() {
        // choose arbtrary amount of onusd to provide and liquidity tokens to recieve
        onusd_liquidity_value = onasset_liquidity_value;
        liquidity_tokens_value = onasset_liquidity_value * Decimal::new(10, 0);
    } else {
        // calculate arbtrary amount of onusd to provide and liquidity tokens to recieve
        onusd_liquidity_value =
            calculate_amm_price(onasset_amm_value, onusd_amm_value) * onasset_liquidity_value;
        liquidity_tokens_value = liquidity_token_supply
            * calculate_liquidity_proportion_from_onusd(onusd_liquidity_value, onusd_amm_value)?;
    }

    Ok((onusd_liquidity_value, liquidity_tokens_value))
}

pub fn calculate_liquidity_provider_values_from_onusd(
    onusd_liquidity_value: Decimal,
    onasset_amm_value: Decimal,
    onusd_amm_value: Decimal,
    liquidity_token_supply: Decimal,
    oracle_price: Decimal,
) -> Result<(Decimal, Decimal)> {
    let liquidity_proportion =
        calculate_liquidity_proportion_from_onusd(onusd_liquidity_value, onusd_amm_value)?;
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;
    let onasset_liquidity_value: Decimal;
    let liquidity_tokens_value: Decimal;
    // check to see if the market is empty
    if onasset_amm_value.is_zero() {
        // choose arbtrary amount of onusd to provide and liquidity tokens to recieve
        onasset_liquidity_value = onusd_liquidity_value / oracle_price;
        liquidity_tokens_value = onusd_liquidity_value * Decimal::new(10, 0);
    } else {
        // calculate arbtrary amount of onusd to provide and liquidity tokens to recieve
        onasset_liquidity_value =
            onusd_liquidity_value / calculate_amm_price(onasset_amm_value, onusd_amm_value);
        liquidity_tokens_value =
            liquidity_proportion * liquidity_token_supply / inverse_liquidity_proportion;
    }

    Ok((onasset_liquidity_value, liquidity_tokens_value))
}

pub fn calculate_liquidity_provider_values_from_liquidity_tokens(
    liquidity_token_value: Decimal,
    onasset_amm_value: Decimal,
    onusd_amm_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Result<(Decimal, Decimal)> {
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );

    let onasset_value = onasset_amm_value * liquidity_proportion;
    let onusd_value = onusd_amm_value * liquidity_proportion;

    Ok((onasset_value, onusd_value))
}

pub fn calculate_amm_price(onasset_value: Decimal, onusd_value: Decimal) -> Decimal {
    onusd_value / onasset_value
}

pub fn calculate_invariant(onasset_value: Decimal, onusd_value: Decimal) -> Decimal {
    onusd_value * onasset_value
}

pub fn calculate_liquidity_proportion_from_liquidity_tokens(
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Decimal {
    if liquidity_token_supply > Decimal::ZERO {
        liquidity_token_value / liquidity_token_supply
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
    asset_info: AssetInfo,
    asset_amount_borrowed: Decimal,
    collateral_ratio: Decimal,
    collateral_amount: Decimal,
    slot: u64,
) -> Result<()> {
    if check_feed_update(asset_info, slot).is_err() {
        return Err(error!(CloneError::OutdatedOracle));
    }
    if (asset_info.price.to_decimal() * asset_amount_borrowed * collateral_ratio)
        > collateral_amount
    {
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
    let pool_onusd = pool.onusd_amount.to_decimal();
    let pool_onasset = pool.onasset_amount.to_decimal();
    let pool_lp_supply = pool.liquidity_token_supply.to_decimal();
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        comet_position.liquidity_token_value.to_decimal(),
        pool_lp_supply,
    );

    let claimable_onusd = rescale_toward_zero(liquidity_proportion * pool_onusd, DEVNET_TOKEN_SCALE);
    let claimable_onasset =
        rescale_toward_zero(liquidity_proportion * pool_onasset, DEVNET_TOKEN_SCALE);

    let borrowed_onusd = comet_position.borrowed_onusd.to_decimal();
    let borrowed_onasset = comet_position.borrowed_onasset.to_decimal();

    let mut impermanent_loss = Decimal::zero();

    if borrowed_onusd > claimable_onusd {
        impermanent_loss += borrowed_onusd - claimable_onusd;
    }

    if borrowed_onasset > claimable_onasset {
        let onasset_debt = borrowed_onasset - claimable_onasset;
        let oracle_marked_debt = pool.asset_info.price.to_decimal() * onasset_debt;
        impermanent_loss += oracle_marked_debt;
    }

    let impermanent_loss_term =
        impermanent_loss * pool.asset_info.il_health_score_coefficient.to_decimal();
    let position_term = borrowed_onusd
        * pool
            .asset_info
            .position_health_score_coefficient
            .to_decimal();

    Ok((impermanent_loss_term, position_term))
}

pub fn calculate_health_score(
    comet: &Comet,
    token_data: &TokenData,
    single_pool_position_index: Option<usize>,
) -> Result<HealthScore> {
    let slot = Clock::get().expect("Failed to get slot.").slot;

    if comet.is_single_pool == 1 {
        return_error_if_false!(
            single_pool_position_index.is_some(),
            CloneError::InvalidBool
        );
        return_error_if_false!(
            single_pool_position_index.unwrap() < (comet.num_positions as usize),
            CloneError::InvalidInputPositionIndex
        );
    }

    let mut total_il_term = Decimal::zero();
    let mut total_position_term = Decimal::zero();

    for index in 0..(comet.num_positions as usize) {
        if let Some(s_index) = single_pool_position_index {
            if s_index != index {
                continue;
            }
        }
        let comet_position = comet.positions[index];
        let pool = token_data.pools[comet_position.pool_index as usize];

        if check_feed_update(pool.asset_info, slot).is_err() {
            return Err(error!(CloneError::OutdatedOracle));
        }
        let (impermanent_loss_term, position_term) =
            calculate_comet_position_loss(token_data, &comet_position)?;

        total_il_term += impermanent_loss_term;
        total_position_term += position_term;
    }

    let effective_collateral =
        comet.calculate_effective_collateral_value(token_data, single_pool_position_index);

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
