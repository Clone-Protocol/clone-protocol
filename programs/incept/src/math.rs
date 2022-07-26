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
    iasset_amount_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    buy: bool,
) -> Result<Value, InceptError> {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    if buy {
        let new_iasset_amm_value = iasset_amm_value.sub(iasset_amount_value)?;
        return invariant.div(new_iasset_amm_value).sub(usdi_amm_value);
    }
    let new_iasset_amm_value = iasset_amm_value.add(iasset_amount_value)?;
    return usdi_amm_value.sub(invariant.div(new_iasset_amm_value));
}

pub fn check_price_confidence(price: Value, confidence: Value) -> Result<(), InceptError> {
    let confidence_40x = confidence.mul(40);
    if confidence_40x.gte(price)? {
        return Err(InceptError::OracleConfidenceOutOfRange.into());
    };
    Ok(())
}

pub fn calculate_liquidity_provider_values_from_iasset(
    iasset_liquidity_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_supply: Value,
) -> Result<(Value, Value), InceptError> {
    let usdi_liquidity_value: Value;
    let liquidity_tokens_value: Value;
    // check to see if the market is empty
    if iasset_amm_value.to_u64() == 0 {
        // choose arbtrary amount of usdi to provide and liquidity tokens to recieve
        usdi_liquidity_value = iasset_liquidity_value;
        liquidity_tokens_value = iasset_liquidity_value.mul(10);
    } else {
        // calculate arbtrary amount of usdi to provide and liquidity tokens to recieve
        usdi_liquidity_value =
            calculate_amm_price(iasset_amm_value, usdi_amm_value).mul(iasset_liquidity_value);
        liquidity_tokens_value = liquidity_token_supply.mul(
            calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value)?,
        );
    }

    return Ok((usdi_liquidity_value, liquidity_tokens_value));
}

pub fn calculate_liquidity_provider_values_from_usdi(
    usdi_liquidity_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_supply: Value,
) -> Result<(Value, Value), InceptError> {
    let liquidity_proportion =
        calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value)?;
    let inverse_liquidity_proportion =
        Value::new(u128::pow(10, DEVNET_TOKEN_SCALE.into()), DEVNET_TOKEN_SCALE)
            .sub(liquidity_proportion)?;
    let iasset_liquidity_value: Value;
    let liquidity_tokens_value: Value;
    // check to see if the market is empty
    if iasset_amm_value.to_u64() == 0 {
        // choose arbtrary amount of usdi to provide and liquidity tokens to recieve
        iasset_liquidity_value = usdi_liquidity_value;
        liquidity_tokens_value = usdi_liquidity_value.mul(10);
    } else {
        // calculate arbtrary amount of usdi to provide and liquidity tokens to recieve
        iasset_liquidity_value =
            usdi_liquidity_value.div(calculate_amm_price(iasset_amm_value, usdi_amm_value));
        liquidity_tokens_value = liquidity_proportion
            .mul(liquidity_token_supply)
            .div(inverse_liquidity_proportion);
    }

    return Ok((iasset_liquidity_value, liquidity_tokens_value));
}

pub fn calculate_liquidity_provider_values_from_liquidity_tokens(
    liquidity_token_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_supply: Value,
) -> Result<(Value, Value), InceptError> {
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );

    let iasset_value = iasset_amm_value.mul(liquidity_proportion);
    let usdi_value = usdi_amm_value.mul(liquidity_proportion);

    return Ok((iasset_value, usdi_value));
}

pub fn calculate_amm_price(iasset_value: Value, usdi_value: Value) -> Value {
    return usdi_value.div(iasset_value);
}

pub fn calculate_invariant(iasset_value: Value, usdi_value: Value) -> Value {
    return usdi_value.mul(iasset_value);
}

pub fn calculate_liquidity_proportion_from_liquidity_tokens(
    liquidity_token_value: Value,
    liquidity_token_supply: Value,
) -> Value {
    return liquidity_token_value.div(liquidity_token_supply);
}

pub fn calculate_liquidity_proportion_from_usdi(
    usdi_liquidity_value: Value,
    usdi_amm_value: Value,
) -> Result<Value, InceptError> {
    return Ok(usdi_liquidity_value.div(usdi_amm_value.add(usdi_liquidity_value)?));
}

pub fn calculate_recentering_values_with_usdi_surplus(
    comet_iasset_borrowed: Value,
    comet_usdi_borrowed: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_value: Value,
    liquidity_token_supply: Value,
) -> (Value, Value, Value) {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );
    let inverse_liquidity_proportion =
        Value::new(u128::pow(10, DEVNET_TOKEN_SCALE.into()), DEVNET_TOKEN_SCALE)
            .sub(liquidity_proportion)
            .unwrap();

    let iasset_debt = comet_iasset_borrowed
        .sub(liquidity_proportion.mul(iasset_amm_value))
        .unwrap()
        .div(inverse_liquidity_proportion);

    let new_iasset_amm_value = iasset_amm_value.sub(iasset_debt).unwrap();

    let usdi_surplus = liquidity_proportion
        .mul(invariant.div(new_iasset_amm_value))
        .sub(comet_usdi_borrowed)
        .unwrap();

    let usdi_amount = invariant
        .div(new_iasset_amm_value)
        .sub(usdi_amm_value)
        .unwrap();

    return (usdi_surplus, usdi_amount, iasset_debt);
}

pub fn calculate_recentering_values_with_iasset_surplus(
    comet_iasset_borrowed: Value,
    comet_usdi_borrowed: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_value: Value,
    liquidity_token_supply: Value,
) -> (Value, Value, Value) {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );
    let inverse_liquidity_proportion =
        Value::new(u128::pow(10, DEVNET_TOKEN_SCALE.into()), DEVNET_TOKEN_SCALE)
            .sub(liquidity_proportion)
            .unwrap();

    let iasset_surplus = liquidity_proportion
        .mul(iasset_amm_value)
        .sub(comet_iasset_borrowed)
        .unwrap()
        .div(inverse_liquidity_proportion);

    let new_iasset_amm_value = iasset_amm_value.add(iasset_surplus).unwrap();

    let usdi_debt = comet_usdi_borrowed
        .sub(liquidity_proportion.mul(invariant.div(new_iasset_amm_value)))
        .unwrap();

    let usdi_burned = usdi_amm_value
        .sub(invariant.div(new_iasset_amm_value))
        .unwrap();

    return (iasset_surplus, usdi_burned, usdi_debt);
}

pub fn check_mint_collateral_sufficient(
    asset_info: AssetInfo,
    asset_amount_borrowed: Value,
    collateral_ratio: Value,
    collateral_amount: Value,
    slot: u64,
) -> Result<(), InceptError> {
    if check_feed_update(asset_info, slot).is_err() {
        return Err(InceptError::OutdatedOracle);
    }

    if asset_info
        .price
        .scale_to(collateral_amount.scale as u8)
        .mul(asset_amount_borrowed)
        .mul(collateral_ratio)
        .gt(collateral_amount)
        .unwrap()
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
    let mut loss = Value::new(0, DEVNET_TOKEN_SCALE);

    for index in 0..comet.num_positions {
        let comet_position = comet.positions[index as usize];
        let pool = token_data.pools[comet_position.pool_index as usize];

        if check_feed_update(pool.asset_info, slot).is_err() {
            return Err(InceptError::OutdatedOracle);
        }

        let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
            comet_position.liquidity_token_value,
            pool.liquidity_token_supply,
        );
        let pool_price = pool.usdi_amount.div(pool.iasset_amount);
        let effective_price = if pool_price.gt(pool.asset_info.price)? {
            pool_price
        } else {
            pool.asset_info.price
        };

        let impermanent_loss;

        if liquidity_proportion.val == 0u128 {
            if comet_position
                .borrowed_usdi
                .gt(comet_position.borrowed_iasset)?
            {
                impermanent_loss = comet_position.borrowed_usdi;
            } else {
                impermanent_loss = comet_position.borrowed_iasset.mul(effective_price);
            }
        } else {
            let claimable_usdi = liquidity_proportion.mul(pool.usdi_amount);
            let claimable_iasset = liquidity_proportion.mul(pool.iasset_amount);
            let init_price = comet_position
                .borrowed_usdi
                .div(comet_position.borrowed_iasset);

            if pool_price.lt(init_price)? {
                impermanent_loss = comet_position.borrowed_usdi.sub(claimable_usdi)?;
            } else if pool_price.gt(init_price)? {
                impermanent_loss =
                    effective_price.mul(comet_position.borrowed_iasset.sub(claimable_iasset)?);
            } else {
                impermanent_loss = Value::new(0u128, DEVNET_TOKEN_SCALE);
            }
        }

        let impermanent_loss_term = impermanent_loss.mul(token_data.il_health_score_coefficient);

        let position_term = comet_position
            .borrowed_usdi
            .mul(pool.asset_info.health_score_coefficient);

        loss = loss.add(impermanent_loss_term)?.add(position_term)?;
    }

    let score = 100f64 - loss.div(comet.total_collateral_amount).to_scaled_f64();

    if score > 0f64 {
        Ok(HealthScore::Healthy { score })
    } else {
        Ok(HealthScore::SubjectToLiquidation { score })
    }
}
