use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::{to_bps_decimal, to_clone_decimal, to_ratio_decimal};
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub static ONUSD_COLLATERAL_INDEX: usize = 0;
pub static USDC_COLLATERAL_INDEX: usize = 1;

#[repr(u64)]
#[derive(PartialEq, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub enum Status {
    Active = 0,
    Frozen = 1,
    Extraction = 2,
    Liquidation = 3,
    Deprecation = 4,
}

pub const NUM_POOLS: usize = 64;
pub const NUM_COLLATERALS: usize = 16;
pub const NUM_ORACLES: usize = 80;
pub const NUM_BORROW_POSITIONS: usize = 24;
pub const NUM_AUTH: usize = 10;

#[account]
#[derive(Default)]
pub struct Clone {
    pub onusd_mint: Pubkey,
    pub token_data: Pubkey,
    pub admin: Pubkey,
    pub auth: [Pubkey; NUM_AUTH],
    pub bump: u8,
    pub comet_liquidator_fee_bps: u16,
    pub borrow_liquidator_fee_bps: u16,
    pub treasury_address: Pubkey,
    pub event_counter: u64,
}

#[account(zero_copy)]
pub struct TokenData {
    pub clone: Pubkey,
    pub num_pools: u64,
    pub num_collaterals: u64,
    pub num_oracles: u64,
    pub pools: [Pool; NUM_POOLS],
    pub collaterals: [Collateral; NUM_COLLATERALS],
    pub oracles: [OracleInfo; NUM_ORACLES],
}

impl Default for TokenData {
    fn default() -> Self {
        Self {
            clone: Pubkey::default(),
            num_pools: 0,
            num_collaterals: 0,
            num_oracles: 0,
            pools: [Pool::default(); NUM_POOLS],
            collaterals: [Collateral::default(); NUM_COLLATERALS],
            oracles: [OracleInfo::default(); NUM_ORACLES],
        }
    }
}

impl TokenData {
    pub fn append_pool(&mut self, new_pool: Pool) {
        self.pools[(self.num_pools) as usize] = new_pool;
        self.num_pools += 1;
    }
    pub fn append_collateral(&mut self, new_collateral: Collateral) {
        self.collaterals[(self.num_collaterals) as usize] = new_collateral;
        self.num_collaterals += 1;
    }
    pub fn append_oracle_info(&mut self, oracle_info: OracleInfo) {
        self.oracles[(self.num_oracles) as usize] = oracle_info;
        self.num_oracles += 1;
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct AssetInfo {
    // 80
    pub onasset_mint: Pubkey,
    pub oracle_info_index: u64,
    pub il_health_score_coefficient: u64,
    pub position_health_score_coefficient: u64,
    pub min_overcollateral_ratio: u64,
    pub max_liquidation_overcollateral_ratio: u64,
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct OracleInfo {
    pub pyth_address: Pubkey,
    pub price: i64,
    pub expo: i64,
    pub status: u64,
    pub last_update_slot: u64,
}

impl OracleInfo {
    pub fn get_price(&self) -> Decimal {
        Decimal::new(self.price, self.expo.try_into().unwrap())
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct Pool {
    pub underlying_asset_token_account: Pubkey,
    pub committed_onusd_liquidity: u64,
    pub onusd_ild: i64,
    pub onasset_ild: i64,
    pub treasury_trading_fee: u64,
    pub liquidity_trading_fee: u64,
    pub asset_info: AssetInfo,
    pub status: u64,
}

#[derive(Default, Debug)]
pub struct SwapSummary {
    pub result: Decimal,
    pub liquidity_fees_paid: Decimal,
    pub treasury_fees_paid: Decimal,
}

impl Pool {
    pub fn calculate_jit_pool(&self, oracle_price: Decimal) -> (Decimal, Decimal) {
        let committed_onusd_liquidity = to_clone_decimal!(self.committed_onusd_liquidity);
        let onusd_ild = to_clone_decimal!(self.onusd_ild);
        let onasset_ild = to_clone_decimal!(self.onasset_ild);
        let pool_onusd =
            rescale_toward_zero(committed_onusd_liquidity - onusd_ild, CLONE_TOKEN_SCALE);
        let pool_onasset = rescale_toward_zero(
            committed_onusd_liquidity / oracle_price - onasset_ild,
            CLONE_TOKEN_SCALE,
        );
        (pool_onusd, pool_onasset)
    }

    pub fn calculate_swap(
        &self,
        oracle_price: Decimal,
        quantity: Decimal,
        quantity_is_input: bool,
        quantity_is_onusd: bool,
        override_liquidity_trading_fee: Option<Decimal>,
        override_treasury_trading_fee: Option<Decimal>,
    ) -> SwapSummary {
        let (pool_onusd, pool_onasset) = self.calculate_jit_pool(oracle_price);
        let invariant = pool_onasset * pool_onusd;
        let default_liquidity_trading_fee = to_bps_decimal!(self.liquidity_trading_fee);
        let default_treasury_trading_fee = to_bps_decimal!(self.treasury_trading_fee);
        let liquidity_trading_fee =
            override_liquidity_trading_fee.unwrap_or(default_liquidity_trading_fee);
        let treasury_trading_fee =
            override_treasury_trading_fee.unwrap_or(default_treasury_trading_fee);

        if quantity_is_input {
            let (i_pool, o_pool) = if quantity_is_onusd {
                (pool_onusd, pool_onasset)
            } else {
                (pool_onasset, pool_onusd)
            };
            let output_before_fees =
                rescale_toward_zero(o_pool - invariant / (i_pool + quantity), CLONE_TOKEN_SCALE);
            let liquidity_fees_paid = rescale_toward_zero(
                output_before_fees * liquidity_trading_fee,
                CLONE_TOKEN_SCALE,
            );
            let treasury_fees_paid =
                rescale_toward_zero(output_before_fees * treasury_trading_fee, CLONE_TOKEN_SCALE);
            let result = rescale_toward_zero(
                output_before_fees - liquidity_fees_paid - treasury_fees_paid,
                CLONE_TOKEN_SCALE,
            );
            SwapSummary {
                result,
                liquidity_fees_paid,
                treasury_fees_paid,
            }
        } else {
            let (o_pool, i_pool) = if quantity_is_onusd {
                (pool_onusd, pool_onasset)
            } else {
                (pool_onasset, pool_onusd)
            };
            let output_before_fees = rescale_toward_zero(
                quantity / (Decimal::ONE - liquidity_trading_fee - treasury_trading_fee),
                CLONE_TOKEN_SCALE,
            );
            let result = rescale_toward_zero(
                invariant / (o_pool - output_before_fees) - i_pool,
                CLONE_TOKEN_SCALE,
            );
            let liquidity_fees_paid = rescale_toward_zero(
                output_before_fees * liquidity_trading_fee,
                CLONE_TOKEN_SCALE,
            );
            let treasury_fees_paid =
                rescale_toward_zero(output_before_fees * treasury_trading_fee, CLONE_TOKEN_SCALE);
            SwapSummary {
                result,
                liquidity_fees_paid,
                treasury_fees_paid,
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        self.committed_onusd_liquidity == 0 && self.onasset_ild == 0 && self.onusd_ild == 0
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct Collateral {
    pub oracle_info_index: u64,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub collateralization_ratio: u64,
    pub status: u64,
    pub scale: u64,
}

#[account(zero_copy)]
#[derive(Default)]
pub struct User {
    // 97
    pub borrows: BorrowPositions,
    pub comet: Comet,
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug)]
pub struct Comet {
    // 46,976
    pub num_positions: u64,
    pub num_collaterals: u64,
    pub positions: [CometPosition; NUM_POOLS], // 255 * 120 = 30,600
    pub collaterals: [CometCollateral; NUM_COLLATERALS], // 255 * 64 = 16,320
}

impl Default for Comet {
    fn default() -> Self {
        Self {
            num_positions: 0,
            num_collaterals: 0,
            positions: [CometPosition::default(); NUM_POOLS],
            collaterals: [CometCollateral::default(); NUM_COLLATERALS],
        }
    }
}

impl Comet {
    pub fn remove_position(&mut self, index: usize) {
        self.positions[index] = self.positions[(self.num_positions - 1) as usize];
        self.positions[(self.num_positions - 1) as usize] = CometPosition {
            ..Default::default()
        };
        self.num_positions -= 1;
    }
    pub fn remove_collateral(&mut self, index: usize) {
        self.collaterals[index] = self.collaterals[(self.num_collaterals - 1) as usize];
        self.collaterals[(self.num_collaterals - 1) as usize] = CometCollateral {
            ..Default::default()
        };
        self.num_collaterals -= 1;
    }
    pub fn add_collateral(&mut self, new_collateral: CometCollateral) {
        self.collaterals[(self.num_collaterals) as usize] = new_collateral;
        self.num_collaterals += 1;
    }
    pub fn add_position(&mut self, new_pool: CometPosition) {
        self.positions[(self.num_positions) as usize] = new_pool;
        self.num_positions += 1;
    }
    pub fn calculate_effective_collateral_value(&self, token_data: &TokenData) -> Decimal {
        let mut total_value = Decimal::new(0, CLONE_TOKEN_SCALE);

        self.collaterals[0..(self.num_collaterals as usize)]
            .iter()
            .enumerate()
            .for_each(|(_, comet_collateral)| {
                let collateral_index = comet_collateral.collateral_index as usize;
                let collateral = token_data.collaterals[collateral_index];
                let collateral_amount = Decimal::new(
                    comet_collateral.collateral_amount.try_into().unwrap(),
                    collateral.scale.try_into().unwrap(),
                );
                let collateral_value = if collateral_index == ONUSD_COLLATERAL_INDEX
                    || collateral_index == USDC_COLLATERAL_INDEX
                {
                    collateral_amount
                } else {
                    let oracle_price =
                        token_data.oracles[collateral.oracle_info_index as usize].get_price();
                    collateral_amount
                        * oracle_price
                        * to_ratio_decimal!(collateral.collateralization_ratio)
                };
                total_value += collateral_value;
            });
        total_value
    }

    pub fn is_empty(&self) -> bool {
        self.num_positions == 0 && self.num_collaterals == 0
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug)]
pub struct CometPosition {
    // 120
    pub pool_index: u64,
    pub committed_onusd_liquidity: u64,
    pub onusd_ild_rebate: i64,
    pub onasset_ild_rebate: i64,
}

impl Default for CometPosition {
    fn default() -> Self {
        Self {
            pool_index: u8::MAX.into(),
            committed_onusd_liquidity: 0,
            onusd_ild_rebate: 0,
            onasset_ild_rebate: 0,
        }
    }
}

impl CometPosition {
    pub fn is_empty(&self) -> bool {
        self.committed_onusd_liquidity == 0
            && self.onusd_ild_rebate == 0
            && self.onasset_ild_rebate == 0
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug)]
pub struct CometCollateral {
    pub collateral_amount: u64,
    pub collateral_index: u64,
}
impl Default for CometCollateral {
    fn default() -> Self {
        Self {
            collateral_amount: 0,
            collateral_index: u8::MAX.into(),
        }
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug)]
pub struct BorrowPositions {
    pub num_positions: u64,
    pub positions: [BorrowPosition; NUM_BORROW_POSITIONS], // 255 * 80 = 20,400
}

impl Default for BorrowPositions {
    fn default() -> Self {
        Self {
            num_positions: 0,
            positions: [BorrowPosition::default(); NUM_BORROW_POSITIONS],
        }
    }
}

impl BorrowPositions {
    pub fn remove(&mut self, index: usize) {
        self.positions[index] = self.positions[(self.num_positions - 1) as usize];
        self.positions[(self.num_positions - 1) as usize] = BorrowPosition {
            ..Default::default()
        };
        self.num_positions -= 1;
    }

    pub fn is_empty(&self) -> bool {
        self.num_positions == 0
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug)]
pub struct BorrowPosition {
    pub pool_index: u64,
    pub borrowed_onasset: u64,
    pub collateral_amount: u64,
    pub collateral_index: u64,
}

impl BorrowPosition {
    pub fn is_empty(&self) -> bool {
        self.borrowed_onasset == 0 && self.collateral_amount == 0
    }
}

impl Default for BorrowPosition {
    fn default() -> Self {
        Self {
            pool_index: u64::MAX,
            borrowed_onasset: 0,
            collateral_amount: 0,
            collateral_index: u64::MAX,
        }
    }
}
