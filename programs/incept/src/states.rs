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
    // 138,800
    pub manager: Pubkey,                // 32
    pub num_pools: u64,                 // 8
    pub num_collaterals: u64,           // 8
    pub pools: [Pool; 255],             // 255 * 392 = 99,960
    pub collaterals: [Collateral; 255], // 255 * 152 = 38,760
    pub chainlink_program: Pubkey,      // 32
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
        let (collateral, index) = match self
            .collaterals
            .iter()
            .position(|x| x.vault == collateral_vault)
        {
            Some(i) => (self.collaterals[i], i),
            None => return Err(InceptError::CollateralNotFound.into()),
        };

        Ok((collateral, index))
    }
    pub fn get_pool_tuple_from_iasset_mint(
        &self,
        iasset_mint: Pubkey,
    ) -> Result<(Pool, usize), InceptError> {
        let (pool, index) = match self
            .pools
            .iter()
            .position(|x| x.asset_info.iasset_mint == iasset_mint)
        {
            Some(i) => (self.pools[i], i),
            None => return Err(InceptError::PoolNotFound.into()),
        };

        Ok((pool, index))
    }
    pub fn get_pool_tuple_from_oracle(
        &self,
        price_feed_addresses: [&Pubkey; 2],
    ) -> Result<(Pool, usize), InceptError> {
        let (pool, index) = match self.pools.iter().position(|x| {
            x.asset_info.price_feed_addresses[0] == *price_feed_addresses[0]
                && x.asset_info.price_feed_addresses[1] == *price_feed_addresses[1]
        }) {
            Some(i) => (self.pools[i], i),
            None => return Err(InceptError::PoolNotFound.into()),
        };

        Ok((pool, index))
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct AssetInfo {
    // 232
    pub iasset_mint: Pubkey,               // 32
    pub price_feed_addresses: [Pubkey; 2], // 64
    pub price: Value,                      // 24
    pub twap: Value,                       // 24
    pub confidence: Value,                 // 24
    pub status: u64,                       // 8
    pub last_update: u64,                  // 8
    pub stable_collateral_ratio: Value,    // 24
    pub crypto_collateral_ratio: Value,    // 24
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    // 392
    pub iasset_token_account: Pubkey,             // 32
    pub usdi_token_account: Pubkey,               // 32
    pub liquidity_token_mint: Pubkey,             // 32
    pub liquidation_iasset_token_account: Pubkey, // 32
    pub comet_liquidity_token_account: Pubkey,    // 32
    pub asset_info: AssetInfo,                    // 232
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
    // 128
    pub authority: Pubkey,           // 32
    pub comet_positions: Pubkey,     // 32
    pub mint_positions: Pubkey,      // 32
    pub liquidity_positions: Pubkey, // 32
}

#[account(zero_copy)]
pub struct CometPositions {
    // 59200
    pub owner: Pubkey,                         // 32
    pub num_positions: u64,                    // 8
    pub comet_positions: [CometPosition; 255], // 255 * 232 = 59160
}

impl Default for CometPositions {
    fn default() -> Self {
        return Self {
            owner: Pubkey::default(),
            num_positions: 0,
            comet_positions: [CometPosition::default(); 255],
        };
    }
}

impl CometPositions {
    pub fn remove(&mut self, index: usize) {
        self.comet_positions[index] = self.comet_positions[(self.num_positions - 1) as usize];
        self.comet_positions[(self.num_positions - 1) as usize] = CometPosition {
            ..Default::default()
        };
        self.num_positions -= 1;
    }
}

#[zero_copy]
#[derive(Default)]
pub struct CometPosition {
    // 232
    pub authority: Pubkey,                   // 32
    pub collateral_amount: Value,            // 24
    pub pool_index: u64,                     // 8
    pub collateral_index: u64,               // 8
    pub borrowed_usdi: Value,                // 24
    pub borrowed_iasset: Value,              // 24
    pub liquidity_token_value: Value,        // 24
    pub lower_price_range: Value,            // 24
    pub upper_price_range: Value,            // 24
    pub comet_liquidation: CometLiquidation, // 40
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
