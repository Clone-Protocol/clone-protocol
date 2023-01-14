use crate::error::*;
use crate::value::*;
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub const DEVNET_TOKEN_SCALE: u32 = 8;
pub const USDI_COLLATERAL_INDEX: usize = 0;
pub const USDC_COLLATERAL_INDEX: usize = 1;

#[zero_copy]
#[derive(PartialEq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Value {
    // 24
    pub val: u128,  // 16
    pub scale: u64, // 8
}

#[zero_copy]
#[derive(PartialEq, Debug, AnchorDeserialize, AnchorSerialize)]
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
    pub fn to_decimal(&self) -> Decimal {
        Decimal::deserialize(self.data)
    }

    pub fn to_u64(&self) -> u64 {
        self.to_decimal().mantissa().try_into().unwrap()
    }
    pub fn from_percent(percent: u16) -> Self {
        Self::new(percent.into(), PERCENT_SCALE.into())
    }
}

impl Default for RawDecimal {
    fn default() -> Self {
        Self::from(Decimal::zero())
    }
}

#[account]
#[derive(Default)]
pub struct Manager {
    // 145
    pub usdi_mint: Pubkey,                     // 32
    pub token_data: Pubkey,                    // 32
    pub admin: Pubkey,                         // 32
    pub bump: u8,                              // 1
    pub liquidation_config: LiquidationConfig, // 48
}

#[zero_copy]
#[derive(PartialEq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct LiquidationConfig {
    // 48
    pub liquidator_fee: RawDecimal,                        // 16,
    pub collateral_full_liquidation_threshold: RawDecimal, // 16
    pub max_health_liquidation: RawDecimal,                // 16
}

#[account(zero_copy)]
pub struct TokenData {
    // 159,248
    pub manager: Pubkey,                         // 32
    pub num_pools: u64,                          // 8
    pub num_collaterals: u64,                    // 8
    pub pools: [Pool; 255],                      // 255 * 480 = 122,400
    pub collaterals: [Collateral; 255],          // 255 * 144 = 36,720
    pub chainlink_program: Pubkey,               // 32
    pub il_health_score_coefficient: RawDecimal, // 16
    pub il_health_score_cutoff: RawDecimal,      // 16
    pub il_liquidation_reward_pct: RawDecimal,   // 16
}

impl Default for TokenData {
    fn default() -> Self {
        return Self {
            manager: Pubkey::default(),
            num_pools: 0,
            num_collaterals: 0,
            pools: [Pool::default(); 255],
            collaterals: [Collateral::default(); 255],
            chainlink_program: Pubkey::default(),
            il_health_score_coefficient: RawDecimal::default(),
            il_health_score_cutoff: RawDecimal::default(),
            il_liquidation_reward_pct: RawDecimal::default(),
        };
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
        Err(InceptError::CollateralNotFound.into())
    }
    pub fn get_pool_tuple_from_iasset_mint(&self, iasset_mint: Pubkey) -> Result<(Pool, usize)> {
        for i in 0..self.num_pools {
            let temp_pool = self.pools[i as usize];
            if temp_pool.asset_info.iasset_mint == iasset_mint {
                return Ok((temp_pool, i as usize));
            }
        }
        Err(InceptError::PoolNotFound.into())
    }
    pub fn get_pool_tuple_from_oracle(
        &self,
        price_feed_addresses: [&Pubkey; 2],
    ) -> Result<(Pool, usize)> {
        for i in 0..self.num_pools {
            let temp_pool = self.pools[i as usize];
            if temp_pool.asset_info.price_feed_addresses[0] == *price_feed_addresses[0]
                && temp_pool.asset_info.price_feed_addresses[1] == *price_feed_addresses[1]
            {
                return Ok((temp_pool, i as usize));
            }
        }
        Err(InceptError::PoolNotFound.into())
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct AssetInfo {
    // 208
    pub iasset_mint: Pubkey,                   // 32
    pub price_feed_addresses: [Pubkey; 2],     // 64
    pub price: RawDecimal,                     // 16
    pub twap: RawDecimal,                      // 16
    pub confidence: RawDecimal,                // 16
    pub status: u64,                           // 8
    pub last_update: u64,                      // 8
    pub stable_collateral_ratio: RawDecimal,   // 16
    pub crypto_collateral_ratio: RawDecimal,   // 16
    pub health_score_coefficient: RawDecimal,  // 16
    pub liquidation_discount_rate: RawDecimal, // 16
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    // 480
    pub iasset_token_account: Pubkey,                // 32
    pub usdi_token_account: Pubkey,                  // 32
    pub liquidity_token_mint: Pubkey,                // 32
    pub liquidation_iasset_token_account: Pubkey,    // 32
    pub comet_liquidity_token_account: Pubkey,       // 32
    pub iasset_amount: RawDecimal,                   // 16
    pub usdi_amount: RawDecimal,                     // 16
    pub liquidity_token_supply: RawDecimal,          // 16
    pub treasury_trading_fee: RawDecimal,            // 16
    pub liquidity_trading_fee: RawDecimal,           // 16
    pub total_minted_amount: RawDecimal,             // 16
    pub supplied_mint_collateral_amount: RawDecimal, // 16
    pub asset_info: AssetInfo,                       // 208
}

impl Pool {
    pub fn total_trading_fee(&self) -> Decimal {
        self.liquidity_trading_fee.to_decimal() + self.treasury_trading_fee.to_decimal()
    }

    // Calculate how much you would get from inputting that amount into the pool.
    pub fn calculate_output_from_input(&self, input: Decimal, input_is_usdi: bool) -> Decimal {
        let pool_usdi = self.usdi_amount.to_decimal();
        let pool_iasset = self.iasset_amount.to_decimal();
        let invariant = pool_iasset * pool_usdi;
        let fee_adjustment = Decimal::ONE - self.total_trading_fee();

        let unadjusted_output = if input_is_usdi {
            pool_iasset - invariant / (pool_usdi + input)
        } else {
            pool_usdi - invariant / (pool_iasset + input)
        };
        unadjusted_output * fee_adjustment
    }

    // Calculate how much you would require to input into the pool given a desired output.
    pub fn calculate_input_from_output(&self, output: Decimal, output_is_usdi: bool) -> Decimal {
        let pool_usdi = self.usdi_amount.to_decimal();
        let pool_iasset = self.iasset_amount.to_decimal();
        let invariant = pool_iasset * pool_usdi;
        let fee_adjustment = Decimal::ONE - self.total_trading_fee();

        if output_is_usdi {
            invariant / (pool_usdi - output / fee_adjustment) - pool_iasset
        } else {
            invariant / (pool_iasset - output / fee_adjustment) - pool_usdi
        }
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Collateral {
    // 144
    pub pool_index: u64,                     // 8
    pub mint: Pubkey,                        // 32
    pub vault: Pubkey,                       // 32
    pub vault_usdi_supply: RawDecimal,       // 16
    pub vault_mint_supply: RawDecimal,       // 16
    pub vault_comet_supply: RawDecimal,      // 16
    pub stable: u64,                         // 8
    pub collateralization_ratio: RawDecimal, // 16
}

#[account]
#[derive(Default)]
pub struct User {
    // 208
    pub is_manager: u64,             // 8
    pub authority: Pubkey,           // 32
    pub single_pool_comets: Pubkey,  // 32
    pub mint_positions: Pubkey,      // 32
    pub liquidity_positions: Pubkey, // 32
    pub comet: Pubkey,               // 32
    pub comet_manager: CometManager, // 40
}

#[account(zero_copy)]
pub struct Comet {
    // 46,976
    pub is_single_pool: u64,                 // 8
    pub owner: Pubkey,                       // 32
    pub num_positions: u64,                  // 8
    pub num_collaterals: u64,                // 8
    pub positions: [CometPosition; 255],     // 255 * 120 = 30,600
    pub collaterals: [CometCollateral; 255], // 255 * 64 = 16,320
}

impl Default for Comet {
    fn default() -> Self {
        return Self {
            is_single_pool: 0,
            owner: Pubkey::default(),
            num_positions: 0,
            num_collaterals: 0,
            positions: [CometPosition::default(); 255],
            collaterals: [CometCollateral::default(); 255],
        };
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
            if temp_collateral.collateral_index == collateral_index.into() {
                index = i as usize;
                break;
            }
        }
        return index;
    }
    pub fn get_pool_index(&self, pool_index: u8) -> usize {
        let mut index: usize = usize::MAX;
        for i in 0..self.num_positions {
            let temp_position = self.positions[i as usize];
            if temp_position.pool_index == pool_index.into() {
                index = i as usize;
                break;
            }
        }
        return index;
    }
    // TODO: update to work with nonstables
    pub fn get_total_collateral_amount(&self) -> Decimal {
        let mut sum = Decimal::new(0, DEVNET_TOKEN_SCALE);
        for i in 0..self.num_collaterals {
            sum = sum + self.collaterals[i as usize].collateral_amount.to_decimal();
        }
        return sum;
    }
    pub fn add_collateral(&mut self, new_collateral: CometCollateral) {
        self.collaterals[(self.num_collaterals) as usize] = new_collateral;
        self.num_collaterals += 1;
    }
    pub fn add_position(&mut self, new_pool: CometPosition) {
        self.positions[(self.num_positions) as usize] = new_pool;
        self.num_positions += 1;
    }

    pub fn calculate_effective_collateral_value(
        &self,
        token_data: &TokenData,
        single_collateral_position_index: Option<usize>,
    ) -> Decimal {
        let mut total_value = Decimal::new(0, DEVNET_TOKEN_SCALE.into());

        self.collaterals[0..(self.num_collaterals as usize)]
            .iter()
            .enumerate()
            .for_each(|(i, comet_collateral)| {
                if let Some(index) = single_collateral_position_index {
                    if index != i {
                        return;
                    }
                }
                let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];
                let collateral_value = if collateral.stable == 1 {
                    comet_collateral.collateral_amount.to_decimal()
                } else {
                    let pool = token_data.pools[collateral.pool_index as usize];
                    let pool_price =
                        pool.usdi_amount.to_decimal() / pool.iasset_amount.to_decimal();
                    let eval_price = if pool_price < pool.asset_info.price.to_decimal() {
                        pool_price
                    } else {
                        pool.asset_info.price.to_decimal()
                    };
                    comet_collateral.collateral_amount.to_decimal() * eval_price
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
    pub authority: Pubkey,                   // 32
    pub pool_index: u64,                     // 8
    pub borrowed_usdi: RawDecimal,           // 16
    pub borrowed_iasset: RawDecimal,         // 16
    pub liquidity_token_value: RawDecimal,   // 16
    pub comet_liquidation: CometLiquidation, // 32
}
impl Default for CometPosition {
    fn default() -> Self {
        return Self {
            authority: Pubkey::default(),
            pool_index: u8::MAX.into(),
            borrowed_usdi: RawDecimal::default(),
            borrowed_iasset: RawDecimal::default(),
            liquidity_token_value: RawDecimal::default(),
            comet_liquidation: CometLiquidation::default(),
        };
    }
}

impl CometPosition {
    pub fn is_empty(&self) -> bool {
        self.borrowed_iasset.to_decimal().is_zero()
            && self.borrowed_usdi.to_decimal().is_zero()
            && self.liquidity_token_value.to_decimal().is_zero()
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
        return Self {
            authority: Pubkey::default(),
            collateral_amount: RawDecimal::default(),
            collateral_index: u8::MAX.into(),
        };
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct CometLiquidation {
    // 32
    pub status: u64,                     // 8
    pub excess_token_type_is_usdi: u64,  // 8
    pub excess_token_amount: RawDecimal, // 16
}

#[zero_copy]
#[derive(PartialEq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct CometManager {
    // 40
    pub membership_token_mint: Pubkey, // 8
    pub comet: Pubkey,                 // 32
}

#[account(zero_copy)]
pub struct LiquidityPositions {
    // 14,320
    pub owner: Pubkey,                                 // 32
    pub num_positions: u64,                            // 8
    pub liquidity_positions: [LiquidityPosition; 255], // 255 * 56 = 14,280
}

impl Default for LiquidityPositions {
    fn default() -> Self {
        return Self {
            owner: Pubkey::default(),
            num_positions: 0,
            liquidity_positions: [LiquidityPosition::default(); 255],
        };
    }
}

impl LiquidityPositions {
    pub fn remove(&mut self, index: usize) {
        self.liquidity_positions[index] =
            self.liquidity_positions[(self.num_positions - 1) as usize];
        self.liquidity_positions[(self.num_positions - 1) as usize] = LiquidityPosition {
            ..Default::default()
        };
        self.num_positions -= 1;
    }
}

#[zero_copy]
#[derive(Default)]
pub struct LiquidityPosition {
    // 56
    pub authority: Pubkey,                 // 32
    pub liquidity_token_value: RawDecimal, // 16
    pub pool_index: u64,                   // 8
}

#[account(zero_copy)]
pub struct MintPositions {
    // 20,440
    pub owner: Pubkey,                       // 32
    pub num_positions: u64,                  // 8
    pub mint_positions: [MintPosition; 255], // 255 * 80 = 20,400
}

impl Default for MintPositions {
    fn default() -> Self {
        return Self {
            owner: Pubkey::default(),
            num_positions: 0,
            mint_positions: [MintPosition::default(); 255],
        };
    }
}

impl MintPositions {
    pub fn remove(&mut self, index: usize) {
        self.mint_positions[index] = self.mint_positions[(self.num_positions - 1) as usize];
        self.mint_positions[(self.num_positions - 1) as usize] = MintPosition {
            ..Default::default()
        };
        self.num_positions -= 1;
    }
}

#[zero_copy]
#[derive(Default)]
pub struct MintPosition {
    // 80
    pub authority: Pubkey,             // 32
    pub collateral_amount: RawDecimal, // 16
    pub pool_index: u64,               // 8
    pub collateral_index: u64,         // 8
    pub borrowed_iasset: RawDecimal,   // 16
}
