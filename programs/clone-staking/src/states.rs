use crate::error::CloneStakingError;
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;

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
    pub fn get_tier_fees(&self, user: &User) -> Result<Option<(u16, u16)>> {
        let left_to_vest = user
            .vesting
            .allocation_amount
            .checked_sub(user.vesting.amount_withdrawn)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?;
        let staked_amount = user
            .staked_tokens
            .checked_add(left_to_vest)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?;
        let mut fees = None;

        self.tiers[..self.num_tiers as usize]
            .iter()
            .for_each(|tier| {
                if staked_amount >= tier.stake_requirement {
                    fees = Some((tier.lp_trading_fee_bps, tier.treasury_trading_fee_bps))
                }
            });
        Ok(fees)
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

#[derive(AnchorSerialize, AnchorDeserialize, Default, Copy, Clone, PartialEq, Eq)]
pub struct UserVestingInfo {
    pub allocation_amount: u64,
    pub amount_withdrawn: u64,
    pub starting_slot: u64,
    pub ending_slot: u64,
}

impl UserVestingInfo {
    pub fn withdrawable_stake(&self, slot: u64, cln_mint_scale: u32) -> Result<u64> {
        let mut allocation_amount = Decimal::from_u64(self.allocation_amount)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?;
        allocation_amount.rescale(0);

        let vesting_weight = if slot >= self.ending_slot {
            Decimal::ONE
        } else {
            let current_slot =
                Decimal::from_u64(slot).ok_or_else(|| CloneStakingError::CheckedMathError)?;
            let starting_slot = Decimal::from_u64(self.starting_slot)
                .ok_or_else(|| CloneStakingError::CheckedMathError)?;
            let ending_slot = Decimal::from_u64(self.ending_slot)
                .ok_or_else(|| CloneStakingError::CheckedMathError)?;

            current_slot
                .checked_sub(starting_slot)
                .ok_or_else(|| CloneStakingError::CheckedMathError)?
                .checked_div(
                    ending_slot
                        .checked_sub(starting_slot)
                        .ok_or_else(|| CloneStakingError::CheckedMathError)?,
                )
                .ok_or_else(|| CloneStakingError::CheckedMathError)?
        };

        let mut total_vested_amount = vesting_weight
            .checked_mul(allocation_amount)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?
            .round_dp_with_strategy(cln_mint_scale, RoundingStrategy::ToZero);

        total_vested_amount.rescale(0);

        let withdrawable = total_vested_amount
            .mantissa()
            .to_u64()
            .ok_or_else(|| CloneStakingError::CheckedMathError)?
            .checked_sub(self.amount_withdrawn)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?;
        Ok(withdrawable)
    }
}

#[account]
#[derive(Default)]
pub struct User {
    pub staked_tokens: u64,
    pub min_slot_withdrawal: u64,
    pub vesting: UserVestingInfo,
    pub bump: u8,
}

impl User {
    pub fn is_empty(&self) -> bool {
        self.staked_tokens == 0 && self.vesting.allocation_amount == self.vesting.amount_withdrawn
    }
}
