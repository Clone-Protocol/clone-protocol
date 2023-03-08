use anchor_lang::prelude::*;

// SWAP EVENT
#[event]
pub struct SwapEvent {
    pub event_id: u64,
    pub user: Pubkey,
    pub pool_index: u8,
    pub is_buy: bool,
    pub iasset: u64,
    pub usdi: u64,
    pub trading_fee: u64,
    pub treasury_fee: u64,
}

// LIQUIDITY CHANGE EVENT
#[event]
pub struct LiquidityDelta {
    pub event_id: u64,
    pub user: Pubkey,
    pub pool_index: u8,
    pub is_concentrated: bool,
    pub iasset_delta: i64,
    pub usdi_delta: i64,
    pub lp_token_delta: i64,
}

// POOL UPDATE
#[event]
pub struct PoolState {
    pub event_id: u64,
    pub pool_index: u8,
    pub iasset: u64,
    pub usdi: u64,
    pub lp_tokens: u64,
    pub oracle_price: u64,
}
