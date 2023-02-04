use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct ManagerInfo {
    // 160
    pub incept: Pubkey,               // 32
    pub incept_manager: Pubkey,       // 32
    pub owner: Pubkey,                // 32
    pub membership_token_supply: u64, // 8
    pub user_account: Pubkey,         // 32
    pub user_bump: u8,                // 1
    pub bump: u8,                     // 1
    pub health_score_threshold: u8,   // 1
    pub in_closing_sequence: bool,    // 1
    pub termination_slot: u64,        // 8
    pub withdrawal_fee_bps: u16,      // 2
    pub management_fee_bps: u16,      // 2
    pub fee_claim_slot: u64,          // 8
}

#[account]
#[derive(Default)]
pub struct Subscriber {
    // 80
    pub owner: Pubkey,          // 32
    pub manager: Pubkey,        // 32
    pub principal: u64,         // 8
    pub membership_tokens: u64, // 8
}
