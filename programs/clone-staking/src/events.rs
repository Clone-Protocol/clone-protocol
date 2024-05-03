use anchor_lang::prelude::*;

// STAKING EVENT
#[event]
pub struct StakingEvent {
    pub user_address: Pubkey,
    pub amount: u64,
    pub previous_amount: u64,
    pub slot: u64,
    pub min_slot_withdrawal: u64,
}
