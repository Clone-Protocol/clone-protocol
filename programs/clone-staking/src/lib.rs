use anchor_lang::prelude::*;
mod error;
mod events;
pub mod instructions;
pub mod states;

pub use instructions::*;
pub use states::*;

declare_id!("stkSasNf1FBzEoViX2i8ZFanzeZuURtJc1cZAgTmwmJ");

#[program]
pub mod clone_staking {
    use self::states::VestingInfo;

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        staking_period_slots: u64,
        vesting_info: VestingInfo,
    ) -> Result<()> {
        instructions::initialize::execute(ctx, staking_period_slots, vesting_info)
    }

    pub fn add_stake(
        ctx: Context<AddStake>,
        user: Pubkey,
        amount: u64,
        vesting_meta: Option<VestingMeta>,
    ) -> Result<()> {
        instructions::add_stake::execute(ctx, user, amount, vesting_meta)
    }

    pub fn withdraw_stake(ctx: Context<WithdrawStake>, amount: u64) -> Result<()> {
        instructions::withdraw_stake::execute(ctx, amount)
    }

    pub fn update_staking_params(
        ctx: Context<UpdateStakingParams>,
        params: Parameters,
    ) -> Result<()> {
        instructions::update_staking_params::execute(ctx, params)
    }
}
