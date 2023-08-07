use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::{to_bps_decimal, to_clone_decimal};
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

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
pub const NUM_BORROW_POSITIONS: usize = 24;
pub const NUM_AUTH: usize = 10;

#[account]
#[derive(Default)]
pub struct Clone {
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
    pub num_pools: u64,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub collateral_oracle_info: OracleInfo,
    pub pools: [Pool; NUM_POOLS],
}

impl Default for TokenData {
    fn default() -> Self {
        Self {
            num_pools: 0,
            collateral_mint: Pubkey::default(),
            collateral_vault: Pubkey::default(),
            collateral_oracle_info: OracleInfo::default(),
            pools: [Pool::default(); NUM_POOLS],
        }
    }
}

impl TokenData {
    pub fn append_pool(&mut self, new_pool: Pool) {
        self.pools[(self.num_pools) as usize] = new_pool;
        self.num_pools += 1;
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct AssetInfo {
    // 80
    pub onasset_mint: Pubkey,
    pub oracle_info: OracleInfo,
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
    pub committed_collateral_liquidity: u64,
    pub collateral_ild: i64,
    pub onasset_ild: i64,
    pub treasury_trading_fee_bps: u64,
    pub liquidity_trading_fee_bps: u64,
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
    pub fn calculate_jit_pool(
        &self,
        onasset_price: Decimal,
        collateral_price: Decimal,
    ) -> (Decimal, Decimal) {
        let committed_collateral_liquidity = to_clone_decimal!(self.committed_collateral_liquidity);
        let collateral_ild = to_clone_decimal!(self.collateral_ild);
        let onasset_ild = to_clone_decimal!(self.onasset_ild);
        let pool_collateral = rescale_toward_zero(
            committed_collateral_liquidity / collateral_price - collateral_ild,
            CLONE_TOKEN_SCALE,
        );
        let pool_onasset = rescale_toward_zero(
            committed_collateral_liquidity / onasset_price - onasset_ild,
            CLONE_TOKEN_SCALE,
        );
        (pool_collateral, pool_onasset)
    }

    pub fn calculate_swap(
        &self,
        onasset_price: Decimal,
        collateral_price: Decimal,
        quantity: Decimal,
        quantity_is_input: bool,
        quantity_is_collateral: bool,
        override_liquidity_trading_fee: Option<Decimal>,
        override_treasury_trading_fee: Option<Decimal>,
    ) -> SwapSummary {
        let (pool_collateral, pool_onasset) = self.calculate_jit_pool(onasset_price, collateral_price);
        let invariant = pool_onasset * pool_collateral;
        let default_liquidity_trading_fee = to_bps_decimal!(self.liquidity_trading_fee_bps);
        let default_treasury_trading_fee = to_bps_decimal!(self.treasury_trading_fee_bps);
        let liquidity_trading_fee =
            override_liquidity_trading_fee.unwrap_or(default_liquidity_trading_fee);
        let treasury_trading_fee =
            override_treasury_trading_fee.unwrap_or(default_treasury_trading_fee);

        if quantity_is_input {
            let (i_pool, o_pool) = if quantity_is_collateral {
                (pool_collateral, pool_onasset)
            } else {
                (pool_onasset, pool_collateral)
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
            let (o_pool, i_pool) = if quantity_is_collateral {
                (pool_collateral, pool_onasset)
            } else {
                (pool_onasset, pool_collateral)
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
        self.committed_collateral_liquidity == 0 && self.onasset_ild == 0 && self.collateral_ild == 0
    }
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
    // ??
    pub num_positions: u64,
    pub collateral_amount: u64,
    pub positions: [CometPosition; NUM_POOLS], // 255 * 120 = 30,600
}

impl Default for Comet {
    fn default() -> Self {
        Self {
            num_positions: 0,
            collateral_amount: 0,
            positions: [CometPosition::default(); NUM_POOLS],
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
    pub fn add_position(&mut self, new_pool: CometPosition) {
        self.positions[(self.num_positions) as usize] = new_pool;
        self.num_positions += 1;
    }
    pub fn is_empty(&self) -> bool {
        self.num_positions == 0 && self.collateral_amount == 0
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug)]
pub struct CometPosition {
    // 120
    pub pool_index: u64,
    pub committed_collateral_liquidity: u64,
    pub collateral_ild_rebate: i64,
    pub onasset_ild_rebate: i64,
}

impl Default for CometPosition {
    fn default() -> Self {
        Self {
            pool_index: u8::MAX.into(),
            committed_collateral_liquidity: 0,
            collateral_ild_rebate: 0,
            onasset_ild_rebate: 0,
        }
    }
}

impl CometPosition {
    pub fn is_empty(&self) -> bool {
        self.committed_collateral_liquidity == 0
            && self.collateral_ild_rebate == 0
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
