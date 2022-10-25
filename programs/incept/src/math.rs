use crate::states::*;
use crate::*;

pub fn check_feed_update(asset_info: AssetInfo, slot: u64) -> Result<()> {
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
) -> Result<Decimal> {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    if buy {
        let new_iasset_amm_value = iasset_amm_value - iasset_amount_value;
        return Ok(invariant / new_iasset_amm_value - usdi_amm_value);
    }
    return Ok(usdi_amm_value - invariant / (iasset_amm_value + iasset_amount_value));
}

// pub fn check_price_confidence(price: Decimal, confidence: Decimal) -> Result<()> {
//     let confidence_40x = confidence * Decimal::new(40, 0);
//     if confidence_40x >= price {
//         return Err(InceptError::OracleConfidenceOutOfRange.into());
//     };
//     Ok(())
// }

pub fn calculate_liquidity_provider_values_from_iasset(
    iasset_liquidity_value: Decimal,
    iasset_amm_value: Decimal,
    usdi_amm_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Result<(Decimal, Decimal)> {
    let usdi_liquidity_value: Decimal;
    let liquidity_tokens_value: Decimal;
    // check to see if the market is empty
    if iasset_amm_value.is_zero() {
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
) -> Result<(Decimal, Decimal)> {
    let liquidity_proportion =
        calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value)?;
    let inverse_liquidity_proportion = Decimal::one() - liquidity_proportion;
    let iasset_liquidity_value: Decimal;
    let liquidity_tokens_value: Decimal;
    // check to see if the market is empty
    if iasset_amm_value.is_zero() {
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
) -> Result<(Decimal, Decimal)> {
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
) -> Result<Decimal> {
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

    let iasset_surplus = (liquidity_proportion * iasset_amm_value - comet_iasset_borrowed)
        / inverse_liquidity_proportion;

    let new_iasset_amm_value = iasset_amm_value + iasset_surplus;

    let new_usdi_amm_value = invariant / new_iasset_amm_value;

    let usdi_debt = comet_usdi_borrowed - liquidity_proportion * new_usdi_amm_value;

    let usdi_burned = usdi_amm_value - new_usdi_amm_value;

    return (iasset_surplus, usdi_burned, usdi_debt);
}

pub fn check_mint_collateral_sufficient(
    asset_info: AssetInfo,
    asset_amount_borrowed: Decimal,
    collateral_ratio: Decimal,
    collateral_amount: Decimal,
    slot: u64,
) -> Result<()> {
    if check_feed_update(asset_info, slot).is_err() {
        return Err(error!(InceptError::OutdatedOracle));
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
    single_pool_index: Option<usize>,
) -> Result<HealthScore> {
    let slot = Clock::get().expect("Failed to get slot.").slot;

    let single_index = if comet.is_single_pool == 1 {
        assert!(single_pool_index.is_some());
        let index = single_pool_index.unwrap();
        assert!(index < comet.num_positions as usize);
        Some(index)
    } else {
        None
    };

    let mut loss = Decimal::zero();

    for index in 0..(comet.num_positions as usize) {
        if let Some(s_index) = single_index {
            if s_index != index {
                continue;
            }
        }
        let comet_position = comet.positions[index as usize];
        let pool = token_data.pools[comet_position.pool_index as usize];

        if check_feed_update(pool.asset_info, slot).is_err() {
            return Err(error!(InceptError::OutdatedOracle));
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

        if liquidity_proportion.is_zero() {
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
                impermanent_loss = effective_price * (borrowed_iasset - claimable_iasset);
            } else {
                impermanent_loss = Decimal::zero();
            }
        }

        let impermanent_loss_term =
            impermanent_loss * token_data.il_health_score_coefficient.to_decimal();
        let position_term = borrowed_usdi * pool.asset_info.health_score_coefficient.to_decimal();
        loss += impermanent_loss_term + position_term;
    }

    let total_collateral_value =
        comet.calculate_effective_collateral_value(token_data, single_pool_index);

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
