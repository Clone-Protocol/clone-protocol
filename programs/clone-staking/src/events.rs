use anchor_lang::prelude::*;

// STAKING EVENT
#[event]
pub struct StakingEvent {
    pub user_address: Pubkey,
    pub amount: u64,
    pub previous_amount: u64,
    pub slot: u64,
    pub min_slot_withdrawal: u64,
    pub vesting_allocation_amount: u64,
    pub vesting_amount_withdrawn: u64,
    pub vesting_start_slot: u64,
    pub vesting_end_slot: u64,
}
