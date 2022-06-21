use crate::error::*;
use anchor_lang::prelude::*;

#[derive(PartialEq, Debug, Clone, Copy, AnchorDeserialize, AnchorSerialize)]
pub enum LiquidationStatus {
    Healthy,
    Partially,
    Fully,
}

impl Default for LiquidationStatus {
    fn default() -> Self {
        LiquidationStatus::Healthy
    }
}
use crate::value::DEVNET_TOKEN_SCALE;

#[zero_copy]
#[derive(PartialEq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Value {
    // 24
    pub val: u128,  // 16
    pub scale: u64, // 8
}

#[account]
#[derive(Default)]
pub struct Manager {
    // 128
    pub usdi_mint: Pubkey,             // 32
    pub liquidated_comet_usdi: Pubkey, // 32
    pub token_data: Pubkey,            // 32
    pub admin: Pubkey,                 // 32
}

#[account(zero_copy)]
pub struct TokenData {
    // 163,304
    pub manager: Pubkey,                    // 32
    pub num_pools: u64,                     // 8
    pub num_collaterals: u64,               // 8
    pub pools: [Pool; 255],                 // 255 * 536 = 136,680
    pub collaterals: [Collateral; 255],     // 255 * 152 = 38,760
    pub chainlink_program: Pubkey,          // 32
    pub il_health_score_coefficient: Value, // 24
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
            il_health_score_coefficient: Value::default(),
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
    pub fn get_collateral_tuple(
        &self,
        collateral_vault: Pubkey,
    ) -> Result<(Collateral, usize), InceptError> {
        let mut collateral = Collateral::default();
        let mut index: usize = 0;
        for i in 0..self.num_collaterals {
            let temp_collateral = self.collaterals[i as usize];
            if temp_collateral.vault == collateral_vault {
                collateral = temp_collateral;
                index = i as usize;
                break;
            }
            if i == self.num_collaterals - 1 {
                return Err(InceptError::CollateralNotFound.into());
            }
        }

        Ok((collateral, index))
    }
    pub fn get_pool_tuple_from_iasset_mint(
        &self,
        iasset_mint: Pubkey,
    ) -> Result<(Pool, usize), InceptError> {
        let mut pool = Pool::default();
        let mut index: usize = 0;
        for i in 0..self.num_pools {
            let temp_pool = self.pools[i as usize];
            if temp_pool.asset_info.iasset_mint == iasset_mint {
                pool = temp_pool;
                index = i as usize;
                break;
            }
            if i == self.num_collaterals - 1 {
                return Err(InceptError::PoolNotFound.into());
            }
        }

        Ok((pool, index))
    }
    pub fn get_pool_tuple_from_oracle(
        &self,
        price_feed_addresses: [&Pubkey; 2],
    ) -> Result<(Pool, usize), InceptError> {
        let mut pool = Pool::default();
        let mut index: usize = 0;
        for i in 0..self.num_pools {
            let temp_pool = self.pools[i as usize];
            if temp_pool.asset_info.price_feed_addresses[0] == *price_feed_addresses[0]
                && temp_pool.asset_info.price_feed_addresses[1] == *price_feed_addresses[1]
            {
                pool = temp_pool;
                index = i as usize;
                break;
            }
            if i == self.num_collaterals - 1 {
                return Err(InceptError::PoolNotFound.into());
            }
        }

        Ok((pool, index))
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct AssetInfo {
    // 256
    pub iasset_mint: Pubkey,               // 32
    pub price_feed_addresses: [Pubkey; 2], // 64
    pub price: Value,                      // 24
    pub twap: Value,                       // 24
    pub confidence: Value,                 // 24
    pub status: u64,                       // 8
    pub last_update: u64,                  // 8
    pub stable_collateral_ratio: Value,    // 24
    pub crypto_collateral_ratio: Value,    // 24
    pub health_score_coefficient: Value,   // 24
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    // 536
    pub iasset_token_account: Pubkey,             // 32
    pub usdi_token_account: Pubkey,               // 32
    pub liquidity_token_mint: Pubkey,             // 32
    pub liquidation_iasset_token_account: Pubkey, // 32
    pub comet_liquidity_token_account: Pubkey,    // 32
    pub iasset_amount: Value,                     // 24
    pub usdi_amount: Value,                       // 24
    pub liquidity_token_supply: Value,            // 24
    pub treasury_trading_fee: Value,              // 24
    pub liquidity_trading_fee: Value,             // 24
    pub asset_info: AssetInfo,                    // 256
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Collateral {
    // 152
    pub pool_index: u64,           // 8
    pub mint: Pubkey,              // 32
    pub vault: Pubkey,             // 32
    pub vault_usdi_supply: Value,  // 24
    pub vault_mint_supply: Value,  // 24
    pub vault_comet_supply: Value, // 24
    pub stable: u64,               // 8
}

#[account]
#[derive(Default)]
pub struct User {
    // 200
    pub is_manager: u64,             // 8
    pub authority: Pubkey,           // 32
    pub single_pool_comets: Pubkey,  // 32
    pub mint_positions: Pubkey,      // 32
    pub liquidity_positions: Pubkey, // 32
    pub comet: Pubkey,               // 32
    pub comet_manager: Pubkey,       // 32
}

#[account(zero_copy)]
pub struct SinglePoolComets {
    // 8200
    pub owner: Pubkey,         // 32
    pub num_comets: u64,       // 8
    pub comets: [Pubkey; 255], // 255 * 32 = 8160
}

impl Default for SinglePoolComets {
    fn default() -> Self {
        return Self {
            owner: Pubkey::default(),
            num_comets: 0,
            comets: [Pubkey::default(); 255],
        };
    }
}

impl SinglePoolComets {
    pub fn remove(&mut self, index: usize) {
        self.comets[index] = self.comets[(self.num_comets - 1) as usize];
        self.comets[(self.num_comets - 1) as usize] = Pubkey::default();
        self.num_comets -= 1;
    }
}

#[account(zero_copy)]
pub struct Comet {
    // 55152
    pub is_single_pool: u64,                 // 8
    pub owner: Pubkey,                       // 32
    pub num_positions: u64,                  // 8
    pub num_collaterals: u64,                // 8
    pub total_collateral_amount: Value,      // 24
    pub positions: [CometPosition; 255],     // 255 * 144 = 38760
    pub collaterals: [CometCollateral; 255], // 255 * 64 = 16320
}

impl Default for Comet {
    fn default() -> Self {
        return Self {
            is_single_pool: 0,
            owner: Pubkey::default(),
            num_positions: 0,
            num_collaterals: 0,
            total_collateral_amount: Value::new(0, DEVNET_TOKEN_SCALE),
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
    pub fn add_collateral(&mut self, new_collateral: CometCollateral) {
        self.collaterals[(self.num_collaterals) as usize] = new_collateral;
        self.num_collaterals += 1;
    }
    pub fn add_position(&mut self, new_pool: CometPosition) {
        self.positions[(self.num_positions) as usize] = new_pool;
        self.num_positions += 1;
    }
}

#[zero_copy]
pub struct CometPosition {
    // 152
    pub authority: Pubkey,                   // 32
    pub pool_index: u64,                     // 8
    pub borrowed_usdi: Value,                // 24
    pub borrowed_iasset: Value,              // 24
    pub liquidity_token_value: Value,        // 24
    pub comet_liquidation: CometLiquidation, // 40
}
impl Default for CometPosition {
    fn default() -> Self {
        return Self {
            authority: Pubkey::default(),
            pool_index: u8::MAX.into(),
            borrowed_usdi: Value::new(0, DEVNET_TOKEN_SCALE),
            borrowed_iasset: Value::new(0, DEVNET_TOKEN_SCALE),
            liquidity_token_value: Value::new(0, DEVNET_TOKEN_SCALE),
            comet_liquidation: CometLiquidation::default(),
        };
    }
}

#[zero_copy]
pub struct CometCollateral {
    // 64
    pub authority: Pubkey,        // 32
    pub collateral_amount: Value, // 24
    pub collateral_index: u64,    // 8
}
impl Default for CometCollateral {
    fn default() -> Self {
        return Self {
            authority: Pubkey::default(),
            collateral_amount: Value::new(0, DEVNET_TOKEN_SCALE),
            collateral_index: u8::MAX.into(),
        };
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct CometLiquidation {
    // 40
    pub status: LiquidationStatus,      // 8
    pub excess_token_type_is_usdi: u64, // 8
    pub excess_token_amount: Value,     // 24
}

#[account(zero_copy)]
pub struct LiquidityPositions {
    // 16,360
    pub owner: Pubkey,                                 // 32
    pub num_positions: u64,                            // 8
    pub liquidity_positions: [LiquidityPosition; 255], // 255 * 64 = 16,320
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
    // 64
    pub authority: Pubkey,            // 32
    pub liquidity_token_value: Value, // 24
    pub pool_index: u64,              // 8
}

#[account(zero_copy)]
pub struct MintPositions {
    // 24,520
    pub owner: Pubkey,                       // 32
    pub num_positions: u64,                  // 8
    pub mint_positions: [MintPosition; 255], // 255 * 96 = 24,480
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
    // 96
    pub authority: Pubkey,        // 32
    pub collateral_amount: Value, // 24
    pub pool_index: u64,          // 8
    pub collateral_index: u64,    // 8
    pub borrowed_iasset: Value,   // 24
}
