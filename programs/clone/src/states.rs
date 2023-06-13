use crate::error::*;
use crate::math::*;
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub const DEVNET_TOKEN_SCALE: u32 = 8;
pub const ONUSD_COLLATERAL_INDEX: usize = 0;
#[allow(dead_code)]
pub const USDC_COLLATERAL_INDEX: usize = 1;
pub const PERCENT_SCALE: u8 = 2;
pub const BPS_SCALE: u32 = 4;

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Value {
    // 24
    pub val: u128,  // 16
    pub scale: u64, // 8
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct RawDecimal {
    // 16
    data: [u8; 16],
}

impl RawDecimal {
    pub fn new(num: i64, scale: u32) -> Self {
        Self::from(Decimal::new(num, scale))
    }
    pub fn from(decimal: Decimal) -> Self {
        RawDecimal {
            data: decimal.serialize(),
        }
    }
    pub fn to_decimal(self) -> Decimal {
        Decimal::deserialize(self.data)
    }

    pub fn to_u64(self) -> u64 {
        self.to_decimal().mantissa().try_into().unwrap()
    }
    pub fn from_percent(percent: u16) -> Self {
        Self::new(percent.into(), PERCENT_SCALE.into())
    }
    pub fn from_bps(bps: i64) -> Self {
        Self::new(bps, BPS_SCALE)
    }
}

impl Default for RawDecimal {
    fn default() -> Self {
        Self::from(Decimal::zero())
    }
}

#[account]
#[derive(Default)]
pub struct Clone {
    // 185
    pub onusd_mint: Pubkey,                    // 32
    pub token_data: Pubkey,                    // 32
    pub admin: Pubkey,                         // 32
    pub bump: u8,                              // 1
    pub liquidation_config: LiquidationConfig, // 48
    pub treasury_address: Pubkey,              // 32
    pub event_counter: u64,                    // 8
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct LiquidationConfig {
    // 32
    pub liquidator_fee: RawDecimal,         // 16,
    pub max_health_liquidation: RawDecimal, // 16
}

#[account(zero_copy)]
pub struct TokenData {
    // 165,320
    pub clone: Pubkey,                         // 32
    pub num_pools: u64,                        // 8
    pub num_collaterals: u64,                  // 8
    pub pools: [Pool; 255],                    // 255 * 504 = 128,520
    pub collaterals: [Collateral; 255],        // 255 * 144 = 36,720
    pub il_health_score_cutoff: RawDecimal,    // 16
    pub il_liquidation_reward_pct: RawDecimal, // 16
}

impl Default for TokenData {
    fn default() -> Self {
        Self {
            clone: Pubkey::default(),
            num_pools: 0,
            num_collaterals: 0,
            pools: [Pool::default(); 255],
            collaterals: [Collateral::default(); 255],
            il_health_score_cutoff: RawDecimal::default(),
            il_liquidation_reward_pct: RawDecimal::default(),
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
    pub fn get_collateral_tuple(&self, collateral_vault: Pubkey) -> Result<(Collateral, usize)> {
        for i in 0..self.num_collaterals {
            let temp_collateral = self.collaterals[i as usize];
            if temp_collateral.vault == collateral_vault {
                return Ok((temp_collateral, i as usize));
            }
        }
        Err(CloneError::CollateralNotFound.into())
    }
    pub fn get_pool_tuple_from_onasset_mint(&self, onasset_mint: Pubkey) -> Result<(Pool, usize)> {
        for i in 0..self.num_pools {
            let temp_pool = self.pools[i as usize];
            if temp_pool.asset_info.onasset_mint == onasset_mint {
                return Ok((temp_pool, i as usize));
            }
        }
        Err(CloneError::PoolNotFound.into())
    }
    pub fn get_pool_tuple_from_oracle(&self, pyth_address: &Pubkey) -> Result<(Pool, usize)> {
        for i in 0..self.num_pools {
            let temp_pool = self.pools[i as usize];
            if temp_pool.asset_info.pyth_address == *pyth_address {
                return Ok((temp_pool, i as usize));
            }
        }
        Err(CloneError::PoolNotFound.into())
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct AssetInfo {
    // 208
    pub onasset_mint: Pubkey,                          // 32
    pub pyth_address: Pubkey,                          // 32
    pub price: RawDecimal,                             // 16
    pub twap: RawDecimal,                              // 16
    pub confidence: RawDecimal,                        // 16
    pub status: u64,                                   // 8
    pub last_update: u64,                              // 8
    pub stable_collateral_ratio: RawDecimal,           // 16
    pub crypto_collateral_ratio: RawDecimal,           // 16
    pub il_health_score_coefficient: RawDecimal,       // 16
    pub position_health_score_coefficient: RawDecimal, // 16
    pub liquidation_discount_rate: RawDecimal,         // 16
    pub max_ownership_pct: RawDecimal,                 // 16
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct Pool {
    // 504
    pub underlying_asset_token_account: Pubkey,      // 32
    pub committed_onusd_liquidity: RawDecimal,       // 16
    pub onusd_ild: RawDecimal,                       // 16
    pub onasset_ild: RawDecimal,                     // 16
    pub treasury_trading_fee: RawDecimal,            // 16
    pub liquidity_trading_fee: RawDecimal,           // 16
    pub total_minted_amount: RawDecimal,             // 16
    pub supplied_mint_collateral_amount: RawDecimal, // 16
    pub asset_info: AssetInfo,                       // 224
    pub deprecated: u64,                             // 8
}

#[derive(Default, Debug)]
pub struct SwapSummary {
    pub result: Decimal,
    pub liquidity_fees_paid: Decimal,
    pub treasury_fees_paid: Decimal,
}

impl Pool {
    pub fn total_trading_fee(&self) -> Decimal {
        self.liquidity_trading_fee.to_decimal() + self.treasury_trading_fee.to_decimal()
    }

    pub fn calculate_jit_pool(&self) -> (Decimal, Decimal) {
        let oracle_price = self.asset_info.price.to_decimal();
        let pool_onusd = rescale_toward_zero(
            self.committed_onusd_liquidity.to_decimal() - self.onusd_ild.to_decimal(),
            DEVNET_TOKEN_SCALE,
        );
        let pool_onasset = rescale_toward_zero(
            self.committed_onusd_liquidity.to_decimal() / oracle_price
                - self.onasset_ild.to_decimal(),
            DEVNET_TOKEN_SCALE,
        );
        (pool_onusd, pool_onasset)
    }

    pub fn calculate_usd_to_buy(&self, amount: Decimal) -> SwapSummary {
        let (pool_onusd, pool_onasset) = self.calculate_jit_pool();
        let invariant = pool_onasset * pool_onusd;
        let liquidity_trading_fee = self.liquidity_trading_fee.to_decimal();
        let treasury_trading_fee = self.treasury_trading_fee.to_decimal();
        let total_trading_fee = liquidity_trading_fee + treasury_trading_fee;
        let fee_adjustment = Decimal::ONE - total_trading_fee;
        let output_before_fees = amount / fee_adjustment;
        let result = rescale_toward_zero(
            invariant / (pool_onasset - output_before_fees) - pool_onusd,
            DEVNET_TOKEN_SCALE,
        );
        let total_fees_paid = output_before_fees - amount;
        let liquidity_fees_paid = rescale_toward_zero(
            total_fees_paid * liquidity_trading_fee / total_trading_fee,
            DEVNET_TOKEN_SCALE,
        );
        let treasury_fees_paid =
            rescale_toward_zero(total_fees_paid - liquidity_fees_paid, DEVNET_TOKEN_SCALE);

        SwapSummary {
            result,
            liquidity_fees_paid,
            treasury_fees_paid,
        }
    }

    pub fn calculate_usd_from_sell(&self, amount: Decimal) -> SwapSummary {
        let (pool_onusd, pool_onasset) = self.calculate_jit_pool();
        let invariant = pool_onasset * pool_onusd;
        let liquidity_trading_fee = self.liquidity_trading_fee.to_decimal();
        let treasury_trading_fee = self.treasury_trading_fee.to_decimal();
        let total_trading_fee = liquidity_trading_fee + treasury_trading_fee;
        let fee_adjustment = Decimal::ONE - total_trading_fee;
        let output_before_fees = pool_onusd - invariant / (pool_onasset + amount);
        let result = rescale_toward_zero(output_before_fees * fee_adjustment, DEVNET_TOKEN_SCALE);
        let total_fees_paid = output_before_fees - result;
        let liquidity_fees_paid = rescale_toward_zero(
            total_fees_paid * liquidity_trading_fee / total_trading_fee,
            DEVNET_TOKEN_SCALE,
        );
        let treasury_fees_paid =
            rescale_toward_zero(total_fees_paid - liquidity_fees_paid, DEVNET_TOKEN_SCALE);

        SwapSummary {
            result,
            liquidity_fees_paid,
            treasury_fees_paid,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.committed_onusd_liquidity.to_decimal().is_zero()
            && self.onasset_ild.to_decimal().is_zero()
            && self.onusd_ild.to_decimal().is_zero()
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Default, Debug)]
pub struct Collateral {
    // 144
    pub pool_index: u64,                     // 8
    pub mint: Pubkey,                        // 32
    pub vault: Pubkey,                       // 32
    pub vault_onusd_supply: RawDecimal,      // 16
    pub vault_mint_supply: RawDecimal,       // 16
    pub vault_comet_supply: RawDecimal,      // 16
    pub stable: u64,                         // 8
    pub collateralization_ratio: RawDecimal, // 16
}

#[account]
#[derive(Default)]
pub struct User {
    // 129
    pub authority: Pubkey,        // 32
    pub borrow_positions: Pubkey, // 32
    pub comet: Pubkey,            // 32
    pub bump: u8,                 // 1
}

#[account(zero_copy)]
pub struct Comet {
    // 46,976
    pub owner: Pubkey,                       // 32
    pub num_positions: u64,                  // 8
    pub num_collaterals: u64,                // 8
    pub positions: [CometPosition; 255],     // 255 * 120 = 30,600
    pub collaterals: [CometCollateral; 255], // 255 * 64 = 16,320
}

impl Default for Comet {
    fn default() -> Self {
        Self {
            owner: Pubkey::default(),
            num_positions: 0,
            num_collaterals: 0,
            positions: [CometPosition::default(); 255],
            collaterals: [CometCollateral::default(); 255],
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
    pub fn get_collateral_index(&self, collateral_index: u8) -> usize {
        let mut index: usize = usize::MAX;
        for i in 0..self.num_collaterals {
            let temp_collateral = self.collaterals[i as usize];
            if temp_collateral.collateral_index == collateral_index as u64 {
                index = i as usize;
                break;
            }
        }
        index
    }
    pub fn get_pool_index(&self, pool_index: u8) -> usize {
        let mut index: usize = usize::MAX;
        for i in 0..self.num_positions {
            let temp_position = self.positions[i as usize];
            if temp_position.pool_index == pool_index as u64 {
                index = i as usize;
                break;
            }
        }
        index
    }
    // TODO: update to work with nonstables
    pub fn get_total_collateral_amount(&self) -> Decimal {
        let mut sum = Decimal::new(0, DEVNET_TOKEN_SCALE);
        for i in 0..self.num_collaterals {
            sum += self.collaterals[i as usize].collateral_amount.to_decimal();
        }
        sum
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
        let mut total_value = Decimal::new(0, DEVNET_TOKEN_SCALE);

        self.collaterals[0..(self.num_collaterals as usize)]
            .iter()
            .enumerate()
            .for_each(|(_, comet_collateral)| {
                let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];
                let collateral_value = if collateral.stable == 1 {
                    comet_collateral.collateral_amount.to_decimal()
                } else {
                    let pool = token_data.pools[collateral.pool_index as usize];
                    comet_collateral.collateral_amount.to_decimal()
                        * pool.asset_info.price.to_decimal()
                        / collateral.collateralization_ratio.to_decimal()
                };
                total_value += collateral_value;
            });

        total_value
    }
}

#[zero_copy]
pub struct CometPosition {
    // 120
    pub authority: Pubkey,                     // 32
    pub pool_index: u64,                       // 8
    pub committed_onusd_liquidity: RawDecimal, //16
    pub onusd_ild_rebate: RawDecimal,          // 16
    pub onasset_ild_rebate: RawDecimal,        // 16
}
impl Default for CometPosition {
    fn default() -> Self {
        Self {
            authority: Pubkey::default(),
            pool_index: u8::MAX.into(),
            committed_onusd_liquidity: RawDecimal::default(),
            onusd_ild_rebate: RawDecimal::default(),
            onasset_ild_rebate: RawDecimal::default(),
        }
    }
}

impl CometPosition {
    pub fn is_empty(&self) -> bool {
        self.committed_onusd_liquidity.to_decimal().is_zero()
            && self.onusd_ild_rebate.to_decimal().is_zero()
            && self.onasset_ild_rebate.to_decimal().is_zero()
    }
}

#[zero_copy]
#[derive(Debug)]
pub struct CometCollateral {
    // 64
    pub authority: Pubkey,             // 32
    pub collateral_amount: RawDecimal, // 24
    pub collateral_index: u64,         // 8
}
impl Default for CometCollateral {
    fn default() -> Self {
        Self {
            authority: Pubkey::default(),
            collateral_amount: RawDecimal::default(),
            collateral_index: u8::MAX.into(),
        }
    }
}
#[account(zero_copy)]
pub struct BorrowPositions {
    // 20,440
    pub owner: Pubkey,                           // 32
    pub num_positions: u64,                      // 8
    pub borrow_positions: [BorrowPosition; 255], // 255 * 80 = 20,400
}

impl Default for BorrowPositions {
    fn default() -> Self {
        Self {
            owner: Pubkey::default(),
            num_positions: 0,
            borrow_positions: [BorrowPosition::default(); 255],
        }
    }
}

impl BorrowPositions {
    pub fn remove(&mut self, index: usize) {
        self.borrow_positions[index] = self.borrow_positions[(self.num_positions - 1) as usize];
        self.borrow_positions[(self.num_positions - 1) as usize] = BorrowPosition {
            ..Default::default()
        };
        self.num_positions -= 1;
    }
}

#[zero_copy]
#[derive(Default)]
pub struct BorrowPosition {
    // 80
    pub authority: Pubkey,             // 32
    pub collateral_amount: RawDecimal, // 16
    pub pool_index: u64,               // 8
    pub collateral_index: u64,         // 8
    pub borrowed_onasset: RawDecimal,  // 16
}
