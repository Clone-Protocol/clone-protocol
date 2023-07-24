use anchor_lang::prelude::*;

pub const MAX_TIERS: usize = 16;

#[account]
pub struct CloneStaking {
    pub admin: Pubkey,
    pub cln_token_mint: Pubkey,
    pub cln_token_vault: Pubkey,
    pub staking_period_slots: u64,
    pub bump: u8,
    pub num_tiers: u8,
    pub tiers: [Tier; MAX_TIERS],
}

impl CloneStaking {
    pub fn get_tier_fees(&self, staked_amount: u64) -> Option<(u16, u16)> {
        let mut fees = None;

        self.tiers[..self.num_tiers as usize]
            .iter()
            .for_each(|tier| {
                if staked_amount >= tier.stake_requirement {
                    fees = Some((tier.lp_trading_fee_bps, tier.treasury_trading_fee_bps))
                }
            });
        fees
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq)]
pub struct Tier {
    pub stake_requirement: u64,
    pub lp_trading_fee_bps: u16,
    pub treasury_trading_fee_bps: u16,
}

impl Default for Tier {
    fn default() -> Self {
        Tier {
            stake_requirement: u64::MAX,
            lp_trading_fee_bps: u16::MAX,
            treasury_trading_fee_bps: u16::MAX,
        }
    }
}

#[account]
#[derive(Default)]
pub struct User {
    pub staked_tokens: u64,
    pub min_slot_withdrawal: u64,
}
