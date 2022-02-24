use crate::error::*;
use anchor_lang::prelude::*;

#[zero_copy]
#[derive(PartialEq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct Value {
    // 17
    pub val: u128, // 16
    pub scale: u8, // 1
}

#[account]
#[derive(Default)]
pub struct Manager {
    // 96
    pub usdi_mint: Pubkey,             // 32
    pub liquidated_comet_usdi: Pubkey, // 32
    pub token_data: Pubkey,            // 32
}

#[account(zero_copy)]
pub struct TokenData {
    // 110,959
    pub manager: Pubkey,                // 32
    pub num_pools: u8,                  // 1
    pub num_collaterals: u8,            // 1
    pub pools: [Pool; 255],             // 255 * 318 = 81,090
    pub collaterals: [Collateral; 255], // 255 * 117 = 29,835
}

impl Default for TokenData {
    fn default() -> Self {
        return Self {
            manager: Pubkey::default(),
            num_pools: 0,
            num_collaterals: 0,
            pools: [Pool::default(); 255],
            collaterals: [Collateral::default(); 255],
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
        price_feed_address: Pubkey,
    ) -> Result<(Pool, usize), InceptError> {
        let (pool, index) = match self
            .pools
            .iter()
            .position(|x| x.asset_info.price_feed_address == price_feed_address)
        {
            Some(i) => (self.pools[i], i),
            None => return Err(InceptError::PoolNotFound.into()),
        };

        Ok((pool, index))
    }
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct AssetInfo {
    // 158
    pub iasset_mint: Pubkey,            // 32
    pub price_feed_address: Pubkey,     // 32
    pub price: Value,                   // 17
    pub twap: Value,                    // 17
    pub confidence: Value,              // 17
    pub status: u8,                     // 1
    pub last_update: u64,               // 8
    pub stable_collateral_ratio: Value, // 17
    pub crypto_collateral_ratio: Value, // 17
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    // 318
    pub iasset_token_account: Pubkey,             // 32
    pub usdi_token_account: Pubkey,               // 32
    pub liquidity_token_mint: Pubkey,             // 32
    pub liquidation_iasset_token_account: Pubkey, // 32
    pub comet_liquidity_token_account: Pubkey,    // 32
    pub asset_info: AssetInfo,                    //158
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct Collateral {
    // 117
    pub pool_index: u8,            // 1
    pub mint: Pubkey,              // 32
    pub vault: Pubkey,             // 32
    pub vault_usdi_supply: Value,  // 17
    pub vault_mint_supply: Value,  // 17
    pub vault_comet_supply: Value, // 17
    pub stable: u8,              // 1
}

#[account]
#[derive(Default)]
pub struct User {
    // 96
    pub authority: Pubkey,       // 32
    pub comet_positions: Pubkey, // 32
    pub mint_positions: Pubkey,  // 32
}

#[account(zero_copy)]
pub struct CometPositions {
    // 6,585
    pub owner: Pubkey,                         // 32
    pub num_positions: u8,                     // 1
    pub comet_positions: [CometPosition; 255], // 40 * 163 = 6,520
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
    // 163
    pub authority: Pubkey,            // 32
    pub collateral_amount: Value,     // 17
    pub pool_index: u8,               // 1
    pub collateral_index: u8,         // 1
    pub borrowed_usdi: Value,         // 17
    pub borrowed_iasset: Value,       // 17
    pub liquidity_token_value: Value, // 17
    pub lower_price_range: Value,     // 17
    pub upper_price_range: Value,     // 17
    pub comet_liquidation: CometLiquidation,     // 19
}

#[zero_copy]
#[derive(PartialEq, Default, Debug)]
pub struct CometLiquidation {
    // 19
    pub liquidated: bool,            // 1
    pub excess_token_type_is_usdi: bool,            // 1
    pub excess_token_amount: Value,            // 17
}

#[account(zero_copy)]
pub struct MintPositions {
    // 9,873
    pub owner: Pubkey,                       // 32
    pub num_positions: u8,                   // 1
    pub mint_positions: [MintPosition; 255], // 120 * 82 = 9,840
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
    // 82
    pub authority: Pubkey,        // 32
    pub collateral_amount: Value, // 17
    pub pool_index: u8,           // 1
    pub collateral_index: u8,     // 1
    pub borrowed_iasset: Value,   // 17
}
