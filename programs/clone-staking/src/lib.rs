use anchor_lang::prelude::*;
mod error;
mod events;
pub mod instructions;
pub mod states;

pub use instructions::*;

declare_id!("42L6bfEYntcmqVcFvHywitcaHhXF9rjYq9C9p9iWQ2X2");

#[program]
pub mod clone_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, staking_period_slots: u64) -> Result<()> {
        instructions::initialize::execute(ctx, staking_period_slots)
    }

    pub fn add_stake(ctx: Context<AddStake>, user: Pubkey, amount: u64) -> Result<()> {
        instructions::add_stake::execute(ctx, user, amount)
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
