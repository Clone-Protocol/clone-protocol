use crate::error::CloneStakingError;
use anchor_lang::prelude::*;
use rust_decimal::prelude::*;

pub const MAX_TIERS: usize = 16;

#[account]
pub struct VestingInfo {
    pub starting_slot: u64,
    pub ending_slot: u64,
}

#[account]
pub struct CloneStaking {
    pub admin: Pubkey,
    pub cln_token_mint: Pubkey,
    pub cln_token_vault: Pubkey,
    pub staking_period_slots: u64,
    pub bump: u8,
    pub vesting_info: VestingInfo,
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

    pub fn calculate_withdrawable_stake_from_vesting(
        &self,
        user: &User,
        slot: u64,
        cln_mint_scale: u32,
    ) -> Result<u64> {
        let allocation_amount = Decimal::from_u64(user.vesting.allocation_amount)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?;

        let vesting_weight = if slot >= self.vesting_info.ending_slot {
            Decimal::ONE
        } else {
            let current_slot =
                Decimal::from_u64(slot).ok_or_else(|| CloneStakingError::CheckedMathError)?;
            let starting_slot = Decimal::from_u64(self.vesting_info.starting_slot)
                .ok_or_else(|| CloneStakingError::CheckedMathError)?;
            let ending_slot = Decimal::from_u64(self.vesting_info.ending_slot)
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

        total_vested_amount.rescale(cln_mint_scale);

        let withdrawable = total_vested_amount
            .mantissa()
            .to_u64()
            .ok_or_else(|| CloneStakingError::CheckedMathError)?
            .checked_sub(user.vesting.amount_withdrawn)
            .ok_or_else(|| CloneStakingError::CheckedMathError)?;

        Ok(withdrawable)
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
pub struct VestingMeta {
    pub allocation_amount: u64,
    pub amount_withdrawn: u64,
}

#[account]
#[derive(Default)]
pub struct User {
    pub staked_tokens: u64,
    pub min_slot_withdrawal: u64,
    pub vesting: VestingMeta,
}
