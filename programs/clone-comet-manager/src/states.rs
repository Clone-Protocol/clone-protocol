use anchor_lang::prelude::*;
use clone::{math::rescale_toward_zero, return_error_if_false, states::DEVNET_TOKEN_SCALE};
use rust_decimal::prelude::*;

use crate::error::CloneCometManagerError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy)]
pub struct RedemptionRequest {
    // 16
    pub membership_tokens: u64,
    pub timestamp: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy)]
pub enum CometManagerStatus {
    Open,
    Closing {
        forcefully_closed: bool,
        termination_timestamp: u64,
    },
}

impl Default for CometManagerStatus {
    fn default() -> Self {
        Self::Open
    }
}

pub const MAX_USER_REDEMPTIONS: usize = 64;
#[account]
#[derive(Default)]
pub struct ManagerInfo {
    pub clone_program: Pubkey,         // 32
    pub clone: Pubkey,                 // 32
    pub owner: Pubkey,                 // 32
    pub membership_token_supply: u64,  // 8
    pub user_account: Pubkey,          // 32
    pub user_bump: u8,                 // 1
    pub bump: u8,                      // 1
    pub status: CometManagerStatus,    // 16
    pub withdrawal_fee_bps: u16,       // 2
    pub management_fee_bps: u16,       // 2
    pub fee_claim_timestamp: u64,      // 8
    pub redemption_strikes: u8,        // 1
    pub last_strike_timestamp: u64,    // 8
    net_value_onusd: u64,              // 8
    pub last_update_slot: u64,         // 8
    pub user_redemptions: Vec<Pubkey>, // 4 + 32 * MAX_USER_REDEMPTIONS
}

impl ManagerInfo {
    pub const MAX_SIZE: usize =
        32 * 3 + 8 + 32 + 1 + 1 + 16 + 2 + 2 + 8 + 1 + 8 + 4 + 32 * MAX_USER_REDEMPTIONS;

    pub fn current_onusd_value(&self) -> Result<Decimal> {
        let slot = Clock::get()?.slot;
        return_error_if_false!(
            slot <= self.last_update_slot,
            CloneCometManagerError::OutdatedUpdateSlot
        );
        Ok(Decimal::new(
            self.net_value_onusd.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        ))
    }

    pub fn update_current_onusd_value(&mut self, value: Decimal) -> Result<()> {
        let new_value = rescale_toward_zero(value, DEVNET_TOKEN_SCALE);
        self.net_value_onusd = new_value.mantissa().try_into().unwrap();
        self.last_update_slot = Clock::get()?.slot;
        Ok(())
    }
}
#[account]
#[derive(Default)]
pub struct Subscriber {
    // 96
    pub owner: Pubkey,                                 // 32
    pub manager: Pubkey,                               // 32
    pub principal: u64,                                // 8
    pub membership_tokens: u64,                        // 8
    pub redemption_request: Option<RedemptionRequest>, // 17
}

impl Subscriber {
    pub const MAX_SIZE: usize = 32 * 2 + 8 * 2 + 17;
}
