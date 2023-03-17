use crate::states::*;
use crate::*;

pub fn check_feed_update(asset_info: AssetInfo, slot: u64) -> Result<()> {
    if asset_info.last_update < slot {
        return Err(InceptError::OutdatedOracle.into());
    }
    Ok(())
}

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

    Ok((usdi_liquidity_value, liquidity_tokens_value))
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

    Ok((iasset_liquidity_value, liquidity_tokens_value))
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

    Ok((iasset_value, usdi_value))
}

pub fn calculate_amm_price(iasset_value: Decimal, usdi_value: Decimal) -> Decimal {
    usdi_value / iasset_value
}

pub fn calculate_invariant(iasset_value: Decimal, usdi_value: Decimal) -> Decimal {
    usdi_value * iasset_value
}

pub fn calculate_liquidity_proportion_from_liquidity_tokens(
    liquidity_token_value: Decimal,
    liquidity_token_supply: Decimal,
) -> Decimal {
    liquidity_token_value / liquidity_token_supply
}

pub fn calculate_liquidity_proportion_from_usdi(
    usdi_liquidity_value: Decimal,
    usdi_amm_value: Decimal,
) -> Result<Decimal> {
    Ok(usdi_liquidity_value / (usdi_amm_value + usdi_liquidity_value))
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
        return Err(error!(InceptError::InvalidMintCollateralRatio));
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
    let pool_usdi = pool.usdi_amount.to_decimal();
    let pool_iasset = pool.iasset_amount.to_decimal();

    let liquidity_proportion = calculate_liquidity_proportion_from_liquidity_tokens(
        comet_position.liquidity_token_value.to_decimal(),
        pool.liquidity_token_supply.to_decimal(),
    );
    let claimable_usdi = liquidity_proportion * pool_usdi;
    let claimable_iasset = liquidity_proportion * pool_iasset;

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

    let mut impermanent_loss = Decimal::zero();

    if borrowed_usdi > claimable_usdi {
        impermanent_loss += borrowed_usdi - claimable_usdi;
    }

    if borrowed_iasset > claimable_iasset {
        let iasset_debt = borrowed_iasset - claimable_iasset;
        let oracle_marked_debt = pool.asset_info.price.to_decimal() * iasset_debt;
        impermanent_loss += oracle_marked_debt;
    }

    let impermanent_loss_term =
        impermanent_loss * pool.asset_info.il_health_score_coefficient.to_decimal();
    let position_term = borrowed_usdi
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
            InceptError::InvalidBool
        );
        return_error_if_false!(
            single_pool_position_index.unwrap() < (comet.num_positions as usize),
            InceptError::InvalidInputPositionIndex
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
            return Err(error!(InceptError::OutdatedOracle));
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
