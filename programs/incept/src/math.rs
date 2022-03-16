use crate::value::{Add, Compare, Div, Mul,  Sub, DEVNET_TOKEN_SCALE};
use crate::*;

pub fn check_feed_update(asset_info: AssetInfo, slot: u64) -> ProgramResult {
    msg!(&asset_info.last_update.to_string()[..]);
    msg!(&slot.to_string()[..]);
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
) -> Value {
    let invariant = calculate_invariant(iasset_amm_value, usdi_amm_value);
    if buy {
        let new_iasset_amm_value = iasset_amm_value.sub(iasset_amount_value).unwrap();
        return invariant
            .div(new_iasset_amm_value)
            .sub(usdi_amm_value)
            .unwrap();
    }
    let new_iasset_amm_value = iasset_amm_value.add(iasset_amount_value).unwrap();
    return usdi_amm_value
        .sub(invariant.div(new_iasset_amm_value))
        .unwrap();
}

pub fn check_price_confidence(price: Value, confidence: Value) -> Result<(), InceptError> {
    let confidence_40x = confidence.mul(40);
    if confidence_40x.gte(price).unwrap() {
        return Err(InceptError::OracleConfidenceOutOfRange.into());
    };
    Ok(())
}

pub fn calculate_liquidity_provider_values_from_iasset(
    iasset_liquidity_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_supply: Value,
) -> (Value, Value) {
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
            calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value),
        );
    }

    return (usdi_liquidity_value, liquidity_tokens_value);
}

pub fn calculate_liquidity_provider_values_from_usdi(
    usdi_liquidity_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_supply: Value,
) -> (Value, Value) {
    let liquidity_proportion =
        calculate_liquidity_proportion_from_usdi(usdi_liquidity_value, usdi_amm_value);
    let inverse_liquidity_proportion =
        Value::new(u128::pow(10, DEVNET_TOKEN_SCALE.into()), DEVNET_TOKEN_SCALE)
            .sub(liquidity_proportion)
            .unwrap();
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

    return (iasset_liquidity_value, liquidity_tokens_value);
}

pub fn calculate_liquidity_provider_values_from_liquidity_tokens(
    liquidity_token_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    liquidity_token_supply: Value,
) -> (Value, Value) {
    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );

    let iasset_value = iasset_amm_value.mul(liquidity_proportion);
    let usdi_value = usdi_amm_value.mul(liquidity_proportion);

    return (iasset_value, usdi_value);
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
) -> Value {
    return usdi_liquidity_value.div(usdi_amm_value.add(usdi_liquidity_value).unwrap());
}

pub fn calculate_comet_price_barrier(
    usdi_liquidity_value: Value,
    iasset_liquidity_value: Value,
    collateral_value: Value,
    iasset_amm_value: Value,
    usdi_amm_value: Value,
    comet_liquidity_token_value: Value,
    liquidity_token_supply: Value,
) -> (Value, Value) {
    let invariant = calculate_invariant(
        iasset_amm_value.add(iasset_liquidity_value).unwrap(),
        usdi_amm_value.add(usdi_liquidity_value).unwrap(),
    );

    let lower_price_barrier = calculate_lower_comet_price_barrier(
        usdi_liquidity_value,
        collateral_value,
        comet_liquidity_token_value,
        liquidity_token_supply,
        invariant,
    );

    let upper_price_barrier = calculate_upper_comet_price_barrier(
        iasset_liquidity_value,
        collateral_value,
        comet_liquidity_token_value,
        liquidity_token_supply,
        invariant,
    );

    return (lower_price_barrier, upper_price_barrier);
}

pub fn calculate_undercollateralized_lower_usdi_barrier(
    usdi_liquidity_value: Value,
    collateral_value: Value,
    comet_liquidity_token_value: Value,
    liquidity_token_supply: Value,
) -> Value {
    return usdi_liquidity_value
        .sub(collateral_value)
        .unwrap()
        .mul(
            liquidity_token_supply
                .add(comet_liquidity_token_value)
                .unwrap(),
        )
        .div(comet_liquidity_token_value);
}

pub fn calculate_undercollateralized_upper_usdi_barrier(
    iasset_liquidity_value: Value,
    collateral_value: Value,
    comet_liquidity_token_value: Value,
    liquidity_token_supply: Value,
    invariant: Value,
) -> Value {
    let a = collateral_value.to_scaled_f64() / invariant.to_scaled_f64();
    let b = calculate_liquidity_proportion_from_liquidity_tokens(
        comet_liquidity_token_value,
        liquidity_token_supply
            .add(comet_liquidity_token_value)
            .unwrap(),
    )
    .to_scaled_f64();
    let c = iasset_liquidity_value.to_scaled_f64();
    return Value::new(
        (((f64::sqrt(f64::powf(b, 2.0) + (4.0 * a * c)) - b) / (2.0 * a)) * f64::powf(10.0, 8.0))
            as u128,
        8,
    );
    // return b
    //     .pow_with_accuracy(2)
    //     .add(a.mul(c).mul(4))
    //     .unwrap()
    //     .sqrt()
    //     .sub(b)
    //     .unwrap()
    //     .div(a.mul(2));
}

pub fn calculate_undercollateralized_iasset_barrier_from_usdi_barrier(
    invariant: Value,
    lower_undercollateralized_usdi_barrier: Value,
) -> Value {
    return invariant.div(lower_undercollateralized_usdi_barrier);
}

pub fn calculate_lower_comet_price_barrier(
    usdi_liquidity_value: Value,
    collateral_value: Value,
    comet_liquidity_token_value: Value,
    liquidity_token_supply: Value,
    invariant: Value,
) -> Value {
    let lower_undercollateralized_usdi_barrier = calculate_undercollateralized_lower_usdi_barrier(
        usdi_liquidity_value,
        collateral_value,
        comet_liquidity_token_value,
        liquidity_token_supply,
    );
    let lower_undercollateralized_iasset_barrier =
        calculate_undercollateralized_iasset_barrier_from_usdi_barrier(
            invariant,
            lower_undercollateralized_usdi_barrier,
        );
    let lower_undercollateralized_price_barrier =
        lower_undercollateralized_usdi_barrier.div(lower_undercollateralized_iasset_barrier);
    let lower_comet_price_barrier = lower_undercollateralized_price_barrier.mul(2);
    return lower_comet_price_barrier;
}

pub fn calculate_upper_comet_price_barrier(
    iasset_liquidity_value: Value,
    collateral_value: Value,
    comet_liquidity_token_value: Value,
    liquidity_token_supply: Value,
    invariant: Value,
) -> Value {
    let upper_undercollateralized_usdi_barrier = calculate_undercollateralized_upper_usdi_barrier(
        iasset_liquidity_value,
        collateral_value,
        comet_liquidity_token_value,
        liquidity_token_supply,
        invariant,
    );

    let upper_undercollateralized_iasset_barrier =
        calculate_undercollateralized_iasset_barrier_from_usdi_barrier(
            invariant,
            upper_undercollateralized_usdi_barrier,
        );

    let upper_undercollateralized_price_barrier =
        upper_undercollateralized_iasset_barrier.div(upper_undercollateralized_usdi_barrier);

    let upper_comet_price_barrier = upper_undercollateralized_price_barrier
        .mul(2)
        .div(Value::new(
            3 * u128::pow(10, DEVNET_TOKEN_SCALE.into()),
            DEVNET_TOKEN_SCALE,
        ));
        
    return upper_comet_price_barrier;
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

    let usdi_debt = comet_usdi_borrowed
        .sub(liquidity_proportion.mul(usdi_amm_value))
        .unwrap()
        .div(inverse_liquidity_proportion);

    let new_usdi_amm_value = iasset_amm_value.sub(usdi_debt).unwrap();

    let iasset_surplus = liquidity_proportion
        .mul(invariant.div(new_usdi_amm_value))
        .sub(comet_iasset_borrowed)
        .unwrap();

    let iasset_amount = invariant
        .div(new_usdi_amm_value)
        .sub(iasset_amm_value)
        .unwrap();

    return (iasset_surplus, iasset_amount, usdi_debt);
}

pub fn check_mint_collateral_sufficient(
    asset_info: AssetInfo,
    asset_amount_borrowed: Value,
    collateral_ratio: Value,
    collateral_amount: Value,
    slot: u64,
) -> Result<(), InceptError> {
    check_feed_update(asset_info, slot).unwrap();
    if asset_info
        .price
        .scale_to(collateral_amount.scale as u8)
        .mul(asset_amount_borrowed)
        .mul(collateral_ratio)
        .gte(collateral_amount)
        .unwrap()
    {
        return Err(InceptError::InvalidMintCollateralRatio.into());
    }
    Ok(())
}
