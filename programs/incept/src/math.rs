use crate::states::*;
use crate::value::{Add, Compare, Div, Mul, Sub, DEVNET_TOKEN_SCALE};
use crate::*;

pub fn check_feed_update(asset_info: AssetInfo, slot: u64) -> ProgramResult {
    if asset_info.last_update < slot {
        return Err(InceptError::OutdatedOracle.into());
    }
    Ok(())
}

pub fn calculate_price_from_iasset(
    iasset_amount_value: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    buy: bool,
) -> Result<Decimal, InceptError> {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    if buy {
        let new_iasset_amm_value = iasset_amm_value - iasset_amount_value;
        return Ok(invariant / new_iasset_amm_value - usdi_amm_value);
    }
    return Ok(usdi_amm_value - invariant / (iasset_amm_value + iasset_amount_value));
}

pub fn check_price_confidence(price: Decimal, confidence: Decimal) -> Result<(), InceptError> {
    let confidence_40x = confidence * Decimal::new(40, 0);
    if confidence_40x >= price {
        return Err(InceptError::OracleConfidenceOutOfRange.into());
    };
    Ok(())
}

pub fn calculate_liquidity_provider_values_from_iasset(
    iasset_liquidity_value: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Result<(Decimal, Decimal), InceptError> {
    let usdi_liquidity_value: Decimal;
    let liquidity_tokens_value: Decimal;
    // check to see if the market is empty
    if iasset_amm_value.mantissa() == 0 {
        // choose arbtrary amount of usdi to provide and liquidity tokens to recieve
        usdi_liquidity_value = iasset_liquidity_value;
        liquidity_tokens_value = iasset_liquidity_value * Decimal::new(10, 0);
    } else {
        // calculate arbtrary amount of usdi to provide and liquidity tokens to recieve
        usdi_liquidity_value =
            calculate_amm_price(iasset_amm_value, usdi_amm_value) * iasset_liquidity_value;
        liquidity_tokens_value = liquidity_token_supply
            * calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value)?;
    }

    return Ok((usdi_liquidity_value, liquidity_tokens_value));
}

pub fn calculate_liquidity_provider_values_from_usdi(
    usdi_liquidity_value: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Result<(Decimal, Decimal), InceptError> {
    let liquidity_proportion =
        calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value)?;
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;
    let iasset_liquidity_value: Decimal;
    let liquidity_tokens_value: Decimal;
    // check to see if the market is empty
    if iasset_amm_value.mantissa() == 0 {
        // choose arbtrary amount of usdi to provide and liquidity tokens to recieve
        iasset_liquidity_value = usdi_liquidity_value;
        liquidity_tokens_value = usdi_liquidity_value * Decimal::new(10, 0);
    } else {
        // calculate arbtrary amount of usdi to provide and liquidity tokens to recieve
        iasset_liquidity_value =
            usdi_liquidity_value / calculate_amm_price(iasset_amm_value, usdi_amm_value);
        liquidity_tokens_value =
            liquidity_proportion * liquidity_token_supply / inverse_liquidity_proportion;
    }

    return Ok((iasset_liquidity_value, liquidity_tokens_value));
}

pub fn calculate_liquidity_provider_values_from_liquidity_tokens(
    liquidity_token_value: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Result<(Decimal, Decimal), InceptError> {
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );

    let iasset_value = iasset_amm_value * liquidity_proportion;
    let usdi_value = usdi_amm_value * liquidity_proportion;

    return Ok((iasset_value, usdi_value));
}

pub fn calculate_amm_price(iasset_value: Decimal, usdi_value: Decimal) -> Decimal {
    return usdi_value / iasset_value;
}

pub fn calculate_invariant(iasset_value: Decimal, usdi_value: Decimal) -> Decimal {
    return usdi_value * iasset_value;
}

pub fn calculate_liquidity_proportion_from_liquidity_tokens(
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Decimal {
    return liquidity_token_value / liquidity_token_supply;
}

pub fn calculate_liquidity_proportion_from_usdi(
    usdi_liquidity_value: Decimal,
    usdi_amm_value: Decimal,
) -> Result<Decimal, InceptError> {
    return Ok(usdi_liquidity_value / (usdi_amm_value + usdi_liquidity_value));
}

pub fn calculate_recentering_values_with_usdi_surplus(
    comet_iasset_borrowed: Decimal,
    comet_usdi_borrowed: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
) -> (Decimal, Decimal, Decimal) {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;

    let iasset_debt = (comet_iasset_borrowed - liquidity_proportion * iasset_amm_value)
        / inverse_liquidity_proportion;

    let new_iasset_amm_value = iasset_amm_value - iasset_debt;

    let usdi_surplus =
        liquidity_proportion * invariant / new_iasset_amm_value - comet_usdi_borrowed;

    let usdi_amount = invariant / new_iasset_amm_value - usdi_amm_value;

    return (usdi_surplus, usdi_amount, iasset_debt);
}

pub fn calculate_partial_recentering_values_with_usdi_surplus(
    comet_iasset_borrowed: Decimal,
    comet_usdi_borrowed: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
    iasset_debt: Decimal,
) -> Result<(Decimal, Decimal, Decimal), InceptError> {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;

    let total_iasset_debt = (comet_iasset_borrowed - liquidity_proportion * iasset_amm_value)
        / inverse_liquidity_proportion;

    if total_iasset_debt < iasset_debt {
        return Err(InceptError::InvalidRecenter);
    }

    let new_iasset_amm_value = iasset_amm_value - iasset_debt;

    let usdi_surplus =
        liquidity_proportion * invariant / new_iasset_amm_value - comet_usdi_borrowed;

    let usdi_amount = invariant / new_iasset_amm_value - usdi_amm_value;

    return Ok((usdi_surplus, usdi_amount, iasset_debt));
}

pub fn calculate_recentering_values_with_iasset_surplus(
    comet_iasset_borrowed: Decimal,
    comet_usdi_borrowed: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
) -> (Decimal, Decimal, Decimal) {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;

    let usdi_debt = (comet_usdi_borrowed - liquidity_proportion * usdi_amm_value)
        / inverse_liquidity_proportion;

    let new_usdi_amm_value = iasset_amm_value - usdi_debt;

    let iasset_surplus =
        liquidity_proportion * invariant / new_usdi_amm_value - comet_iasset_borrowed;

    let iasset_amount = invariant / new_usdi_amm_value - iasset_amm_value;

    return (iasset_surplus, iasset_amount, usdi_debt);
}

pub fn calculate_partial_recentering_values_with_iasset_surplus(
    comet_iasset_borrowed: Decimal,
    comet_usdi_borrowed: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
    usdi_debt: Decimal,
) -> Result<(Decimal, Decimal, Decimal), InceptError> {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;

    let total_usdi_debt = (comet_usdi_borrowed - liquidity_proportion * usdi_amm_value)
        / inverse_liquidity_proportion;

    if total_usdi_debt < usdi_debt {
        return Err(InceptError::InvalidRecenter);
    }

    let new_usdi_amm_value = iasset_amm_value - usdi_debt;

    let iasset_surplus =
        liquidity_proportion * invariant / new_usdi_amm_value - comet_iasset_borrowed;

    let iasset_amount = invariant / new_usdi_amm_value - iasset_amm_value;

    return Ok((iasset_surplus, iasset_amount, usdi_debt));
}

pub fn check_mint_collateral_sufficient(
    asset_info: AssetInfo,
    asset_amount_borrowed: Decimal,
    collateral_ratio: Decimal,
    collateral_amount: Decimal,
    slot: u64,
) -> Result<(), InceptError> {
    if check_feed_update(asset_info, slot).is_err() {
        return Err(InceptError::OutdatedOracle);
    }
    if (asset_info.price.to_decimal() * asset_amount_borrowed * collateral_ratio)
        > collateral_amount
    {
        return Err(InceptError::InvalidMintCollateralRatio.into());
    }
    Ok(())
}

#[derive(Clone, Debug)]
pub enum HealthScore {
    Healthy { score: f64 },
    SubjectToLiquidation { score: f64 },
}

pub fn calculate_health_score(
    comet: &Comet,
    token_data: &TokenData,
) -> Result<HealthScore, InceptError> {
    let slot = Clock::get().expect("Failed to get slot.").slot;
    let mut loss = Decimal::zero();

    for index in 0..comet.num_positions {
        let comet_position = comet.positions[index as usize];
        let pool = token_data.pools[comet_position.pool_index as usize];

        if check_feed_update(pool.asset_info, slot).is_err() {
            return Err(InceptError::OutdatedOracle);
        }

        let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
            comet_position.liquidity_token_value.to_decimal(),
            pool.liquidity_token_supply.to_decimal(),
        );
        let pool_usdi = pool.usdi_amount.to_decimal();
        let pool_iasset = pool.iasset_amount.to_decimal();
        let pool_price = pool_usdi / pool_iasset;
        let effective_price = if pool_price > pool.asset_info.price.to_decimal() {
            pool_price
        } else {
            pool.asset_info.price.to_decimal()
        };

        let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
        let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

        let impermanent_loss;

        if liquidity_proportion.mantissa() == 0 {
            if comet_position.borrowed_usdi.to_decimal()
                > comet_position.borrowed_iasset.to_decimal()
            {
                impermanent_loss = borrowed_usdi;
            } else {
                impermanent_loss = borrowed_iasset * effective_price;
            }
        } else {
            let claimable_usdi = liquidity_proportion * pool_usdi;
            let claimable_iasset = liquidity_proportion * pool_iasset;
            let init_price = borrowed_usdi / borrowed_iasset;

            if pool_price < init_price {
                impermanent_loss = borrowed_usdi - claimable_usdi;
            } else if pool_price > init_price {
                impermanent_loss = effective_price * borrowed_iasset - claimable_iasset;
            } else {
                impermanent_loss = Decimal::zero();
            }
        }

        let impermanent_loss_term =
            impermanent_loss * token_data.il_health_score_coefficient.to_decimal();
        let position_term = borrowed_usdi * pool.asset_info.health_score_coefficient.to_decimal();
        loss += impermanent_loss_term + position_term;
    }

    let total_collateral_value = comet.calculate_effective_collateral_value(token_data);

    let score = Decimal::new(100, 0) - loss / total_collateral_value;

    if score.is_sign_positive() {
        Ok(HealthScore::Healthy {
            score: score.to_f64().unwrap(),
        })
    } else {
        Ok(HealthScore::SubjectToLiquidation {
            score: score.to_f64().unwrap(),
        })
    }
}
