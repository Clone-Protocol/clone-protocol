use crate::states::*;
use crate::CLONE_STAKING_SEED;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum Parameters {
    Staking {
        staking_period_slots: u64,
    },
    Tier {
        num_tiers: u8,
        index: u8,
        stake_requirement: u64,
        lp_trading_fee_bps: u16,
        treasury_trading_fee_bps: u16,
    },
}

#[derive(Accounts)]
#[instruction(
    params: Parameters
)]
pub struct UpdateStakingParams<'info> {
    #[account(address = clone_staking.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump,
        has_one = admin
    )]
    pub clone_staking: Account<'info, CloneStaking>,
}

pub fn execute(ctx: Context<UpdateStakingParams>, params: Parameters) -> Result<()> {
    let clone_staking = &mut ctx.accounts.clone_staking;

    match params {
        Parameters::Staking {
            staking_period_slots,
        } => clone_staking.staking_period_slots = staking_period_slots,
        Parameters::Tier {
            num_tiers,
            index,
            stake_requirement,
            lp_trading_fee_bps,
            treasury_trading_fee_bps,
        } => {
            clone_staking.num_tiers = num_tiers;
            clone_staking.tiers[index as usize] = Tier {
                stake_requirement,
                lp_trading_fee_bps,
                treasury_trading_fee_bps,
            };
        }
    }

    Ok(())
}
