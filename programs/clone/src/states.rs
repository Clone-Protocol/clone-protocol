use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::error::CloneError;
use crate::{to_bps_decimal, to_clone_decimal};
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;
use std::vec::Vec;

#[derive(Clone, PartialEq, Copy, Eq, Debug, AnchorDeserialize, AnchorSerialize, Default)]
pub enum Status {
    Active = 0,
    #[default]
    Frozen = 1,
    Extraction = 2,
    Liquidation = 3,
    Deprecation = 4,
}

pub const NUM_POOLS: usize = 64;
pub const NUM_BORROW_POSITIONS: usize = 24;
pub const NUM_AUTH: usize = 10;

#[account]
#[derive(Default)]
pub struct Clone {
    pub admin: Pubkey,
    pub auth: [Pubkey; NUM_AUTH],
    pub bump: u8,
    pub collateral: Collateral,
    pub comet_collateral_ild_liquidator_fee_bps: u16,
    pub comet_onasset_ild_liquidator_fee_bps: u16,
    pub borrow_liquidator_fee_bps: u16,
    pub treasury_address: Pubkey,
    pub event_counter: u64,
    pub non_auth_liquidations_enabled: bool,
}
#[account]
pub struct Pools {
    pub pools: Vec<Pool>,
}

impl Default for Pools {
    fn default() -> Self {
        Self { pools: Vec::new() }
    }
}

#[account]
pub struct Oracles {
    pub oracles: Vec<OracleInfo>,
}

impl Default for Oracles {
    fn default() -> Self {
        Self {
            oracles: Vec::new(),
        }
    }
}

#[derive(Clone, PartialEq, Eq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct AssetInfo {
    pub onasset_mint: Pubkey,
    pub oracle_info_index: u8,
    pub il_health_score_coefficient: u16,
    pub position_health_score_coefficient: u16,
    pub min_overcollateral_ratio: u16,
    pub max_liquidation_overcollateral_ratio: u16,
}

impl AssetInfo {
    pub fn is_valid_overcollateral_ratios(&self) -> bool {
        self.min_overcollateral_ratio > 100
            && self.max_liquidation_overcollateral_ratio > self.min_overcollateral_ratio
    }
}

#[derive(Clone, PartialEq, Default, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub enum OracleSource {
    #[default]
    PYTH,
    SWITCHBOARD,
    PYTHV2,
}

#[derive(Clone, PartialEq, Eq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct OracleInfo {
    pub source: OracleSource,
    pub address: Pubkey,
    pub price: i64,
    pub expo: u8,
    pub status: Status,
    pub last_update_slot: u64,
    pub rescale_factor: u8,
}

impl OracleInfo {
    pub fn get_price(&self) -> Result<Decimal> {
        let mut price = Decimal::new(self.price, self.expo.into());
        if self.rescale_factor != 0 {
            price = price
                .checked_div(Decimal::new(1, self.rescale_factor.into()))
                .ok_or(error!(CloneError::CheckedMathError))?;
        }
        return Ok(price);
    }
}

#[derive(Clone, PartialEq, Eq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Pool {
    pub underlying_asset_token_account: Pubkey,
    pub committed_collateral_liquidity: u64,
    pub collateral_ild: i64,
    pub onasset_ild: i64,
    pub treasury_trading_fee_bps: u16,
    pub liquidity_trading_fee_bps: u16,
    pub asset_info: AssetInfo,
    pub status: Status,
}

#[derive(Default, Debug)]
pub struct SwapSummary {
    pub result: Decimal,
    pub liquidity_fees_paid: Decimal,
    pub treasury_fees_paid: Decimal,
}

impl Pool {
    pub fn calculate_jit_pool(
        &self,
        onasset_price: Decimal,
        collateral_price: Decimal,
        collateral: &Collateral,
    ) -> Result<(Decimal, Decimal)> {
        let committed_collateral_liquidity =
            collateral.to_collateral_decimal(self.committed_collateral_liquidity)?;
        let onasset_ild = to_clone_decimal!(self.onasset_ild);
        let center_price = onasset_price
            .checked_div(collateral_price)
            .ok_or(error!(CloneError::CheckedMathError))?;
        let pool_collateral = collateral.to_collateral_decimal(
            TryInto::<i64>::try_into(self.committed_collateral_liquidity)
                .map_err(|_| CloneError::IntTypeConversionError)?
                .checked_sub(self.collateral_ild)
                .ok_or(error!(CloneError::CheckedMathError))?,
        )?;
        let pool_onasset = rescale_toward_zero(
            (committed_collateral_liquidity
                .checked_div(center_price)
                .ok_or(error!(CloneError::CheckedMathError))?)
            .checked_sub(onasset_ild)
            .ok_or(error!(CloneError::CheckedMathError))?,
            CLONE_TOKEN_SCALE,
        );
        Ok((pool_collateral, pool_onasset))
    }

    // This function calculate either the resultant amount received or
    // required as input into the pool depending on the `quantity` specifications.
    // Fees are calculated as well and are always of the output type of the swap.
    pub fn calculate_swap(
        &self,
        onasset_price: Decimal,
        collateral_price: Decimal,
        quantity: Decimal,
        quantity_is_input: bool,
        quantity_is_collateral: bool,
        collateral: &Collateral,
        override_liquidity_trading_fee: Option<Decimal>,
        override_treasury_trading_fee: Option<Decimal>,
    ) -> Result<SwapSummary> {
        let (pool_collateral, pool_onasset) =
            self.calculate_jit_pool(onasset_price, collateral_price, collateral)?;
        let invariant = pool_onasset
            .checked_mul(pool_collateral)
            .ok_or(error!(CloneError::CheckedMathError))?;
        let default_liquidity_trading_fee = to_bps_decimal!(self.liquidity_trading_fee_bps);
        let default_treasury_trading_fee = to_bps_decimal!(self.treasury_trading_fee_bps);
        let liquidity_trading_fee =
            override_liquidity_trading_fee.unwrap_or(default_liquidity_trading_fee);
        let treasury_trading_fee =
            override_treasury_trading_fee.unwrap_or(default_treasury_trading_fee);
        if quantity_is_input {
            let (i_pool, o_pool, o_scale) = if quantity_is_collateral {
                (pool_collateral, pool_onasset, CLONE_TOKEN_SCALE)
            } else {
                (pool_onasset, pool_collateral, collateral.scale.into())
            };
            // o_pool - (invariant / (i_pool + quantity)) = output_before_fees
            let output_before_fees = rescale_toward_zero(
                o_pool
                    .checked_sub(
                        invariant
                            .checked_div(
                                i_pool
                                    .checked_add(quantity)
                                    .ok_or(error!(CloneError::CheckedMathError))?,
                            )
                            .ok_or(error!(CloneError::CheckedMathError))?,
                    )
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            let liquidity_fees_paid = rescale_toward_zero(
                output_before_fees
                    .checked_mul(liquidity_trading_fee)
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            let treasury_fees_paid = rescale_toward_zero(
                output_before_fees
                    .checked_mul(treasury_trading_fee)
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            let result = rescale_toward_zero(
                output_before_fees
                    .checked_sub(
                        liquidity_fees_paid
                            .checked_add(treasury_fees_paid)
                            .ok_or(error!(CloneError::CheckedMathError))?,
                    )
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            Ok(SwapSummary {
                result,
                liquidity_fees_paid,
                treasury_fees_paid,
            })
        } else {
            let (o_pool, i_pool, i_scale, o_scale) = if quantity_is_collateral {
                (
                    pool_collateral,
                    pool_onasset,
                    CLONE_TOKEN_SCALE,
                    collateral.scale.into(),
                )
            } else {
                (
                    pool_onasset,
                    pool_collateral,
                    collateral.scale.into(),
                    CLONE_TOKEN_SCALE,
                )
            };
            let output_before_fees = rescale_toward_zero(
                quantity
                    .checked_div(
                        Decimal::ONE
                            .checked_sub(
                                liquidity_trading_fee
                                    .checked_add(treasury_trading_fee)
                                    .ok_or(error!(CloneError::CheckedMathError))?,
                            )
                            .ok_or(error!(CloneError::CheckedMathError))?,
                    )
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            // invariant / (o_pool - output_before_fees) - i_pool = result
            let result = rescale_toward_zero(
                invariant
                    .checked_div(
                        o_pool
                            .checked_sub(output_before_fees)
                            .ok_or(error!(CloneError::CheckedMathError))?,
                    )
                    .ok_or(error!(CloneError::CheckedMathError))?
                    .checked_sub(i_pool)
                    .ok_or(error!(CloneError::CheckedMathError))?,
                i_scale,
            );
            let liquidity_fees_paid = rescale_toward_zero(
                output_before_fees
                    .checked_mul(liquidity_trading_fee)
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            let treasury_fees_paid = rescale_toward_zero(
                output_before_fees
                    .checked_mul(treasury_trading_fee)
                    .ok_or(error!(CloneError::CheckedMathError))?,
                o_scale,
            );
            Ok(SwapSummary {
                result,
                liquidity_fees_paid,
                treasury_fees_paid,
            })
        }
    }

    pub fn is_empty(&self) -> bool {
        self.committed_collateral_liquidity == 0
            && self.onasset_ild == 0
            && self.collateral_ild == 0
    }
}

#[derive(Clone, PartialEq, Eq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Collateral {
    pub oracle_info_index: u8,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub collateralization_ratio: u8,
    pub scale: u8,
}

impl Collateral {
    pub fn to_collateral_decimal<T: TryInto<i64>>(&self, value: T) -> Result<Decimal> {
        if let Ok(num) = TryInto::<i64>::try_into(value) {
            Ok(Decimal::new(
                num,
                self.scale
                    .try_into()
                    .map_err(|_| CloneError::IntTypeConversionError)?,
            ))
        } else {
            Err(error!(CloneError::InvalidConversion))
        }
    }
}

#[account]
pub struct User {
    pub borrows: Vec<Borrow>,
    pub comet: Comet,
}

#[derive(Clone, PartialEq, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Comet {
    pub collateral_amount: u64,
    pub positions: Vec<LiquidityPosition>,
}

impl Comet {
    pub fn calculate_effective_collateral_value(&self, collateral: &Collateral) -> Result<Decimal> {
        let collateralization_ratio = collateral
            .collateralization_ratio
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?;
        Ok(to_clone_decimal!(self
            .collateral_amount
            .checked_mul(collateralization_ratio)
            .ok_or(error!(CloneError::CheckedMathError))?))
    }

    pub fn is_empty(&self) -> bool {
        self.positions.len() == 0 && self.collateral_amount == 0
    }
}

#[derive(Clone, PartialEq, Eq, Copy, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct LiquidityPosition {
    pub pool_index: u8,
    pub committed_collateral_liquidity: u64,
    pub collateral_ild_rebate: i64,
    pub onasset_ild_rebate: i64,
}

impl Default for LiquidityPosition {
    fn default() -> Self {
        Self {
            pool_index: u8::MAX.into(),
            committed_collateral_liquidity: 0,
            collateral_ild_rebate: 0,
            onasset_ild_rebate: 0,
        }
    }
}

impl LiquidityPosition {
    pub fn is_empty(&self) -> bool {
        self.committed_collateral_liquidity == 0
            && self.collateral_ild_rebate == 0
            && self.onasset_ild_rebate == 0
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Borrow {
    pub pool_index: u8,
    pub borrowed_onasset: u64,
    pub collateral_amount: u64,
}

impl Borrow {
    pub fn is_empty(&self) -> bool {
        self.borrowed_onasset == 0 && self.collateral_amount == 0
    }
}

impl Default for Borrow {
    fn default() -> Self {
        Self {
            pool_index: u8::MAX,
            borrowed_onasset: 0,
            collateral_amount: 0,
        }
    }
}
