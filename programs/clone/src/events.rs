use anchor_lang::prelude::*;

// SWAP EVENT
#[event]
pub struct SwapEvent {
    pub event_id: u64,
    pub user_address: Pubkey,
    pub pool_index: u8,
    pub is_buy: bool,
    pub onasset: u64,
    pub onusd: u64,
    pub trading_fee: u64,
    pub treasury_fee: u64,
}

// LIQUIDITY CHANGE EVENT
#[event]
pub struct LiquidityDelta {
    pub event_id: u64,
    pub user_address: Pubkey,
    pub pool_index: u8,
    pub committed_onusd_delta: i64,
    pub onusd_ild_delta: i64,
    pub onasset_ild_delta: i64,
}

// POOL UPDATE
#[event]
pub struct PoolState {
    pub event_id: u64,
    pub pool_index: u8,
    pub onasset_ild: i64,
    pub onusd_ild: i64,
    pub committed_onusd_liquidity: u64,
    pub oracle_price: u64,
}

// BORROW UPDATE
#[event]
pub struct BorrowUpdate {
    pub event_id: u64,
    pub pool_index: u8,
    pub user_address: Pubkey,
    pub is_liquidation: bool,
    pub collateral_supplied: u64,
    pub collateral_delta: i64,
    pub collateral_index: u8,
    pub borrowed_amount: u64,
    pub borrowed_delta: i64,
}
