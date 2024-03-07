use anchor_lang::prelude::*;
pub mod instructions;
pub mod states;

use instructions::*;

declare_id!("HeXLPMQr13eLB6k6rvX2phBg3ETpvzqMBnZxSZy9tvn3");

#[program]
pub mod isolated_margin_comets {

    use super::*;

    pub fn initialize_position_manager(
        ctx: Context<InitializePositionManager>,
        authority: Pubkey,
    ) -> Result<()> {
        instructions::initialize::execute(ctx, authority)
    }

    pub fn add_isolated_comet(ctx: Context<AddIsolatedComet>, unique_seed: u8) -> Result<()> {
        instructions::add_isolated_comet::execute(ctx, unique_seed)
    }

    pub fn close_isolated_comet(
        ctx: Context<CloseIsolatedComet>,
        position_index: u8,
    ) -> Result<()> {
        instructions::close_isolated_comet::execute(ctx, position_index)
    }

    pub fn add_collateral_to_isolated_comet(
        ctx: Context<AddCollateralToIsolatedComet>,
        position_index: u8,
    ) -> Result<()> {
        instructions::add_collateral_to_isolated_comet::execute(ctx, position_index)
    }

    pub fn withdraw_collateral_from_isolated_comet(
        ctx: Context<WithdrawCollateralFromIsolatedComet>,
        position_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_collateral_from_isolated_comet::execute(ctx, position_index, amount)
    }

    pub fn add_liquidity_to_isolated_comet(
        ctx: Context<AddLiquidityToIsolatedComet>,
        position_index: u8,
        pool_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity_to_isolated_comet::execute(
            ctx,
            position_index,
            pool_index,
            amount,
        )
    }

    pub fn withdraw_liquidity_from_isolated_comet(
        ctx: Context<WithdrawLiquidityFromIsolatedComet>,
        position_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_liquidity_from_isolated_comet::execute(ctx, position_index, amount)
    }

    pub fn pay_isolated_comet_impermanent_loss_debt(
        ctx: Context<PayIsolatedCometImpermanentLossDebt>,
        owner: Pubkey,
        position_index: u8,
        amount: u64,
        payment_type: PaymentType,
    ) -> Result<()> {
        instructions::pay_isolated_comet_impermanent_loss_debt::execute(
            ctx,
            owner,
            position_index,
            amount,
            payment_type,
        )
    }

    pub fn collect_lp_reward_from_isolated_comet(
        ctx: Context<CollectLpRewardsFromIsolatedComet>,
        position_index: u8,
    ) -> Result<()> {
        instructions::collect_lp_rewards_from_isolated_comet::execute(ctx, position_index)
    }

    pub fn close_token_account(ctx: Context<CloseTokenAccount>, position_index: u8) -> Result<()> {
        instructions::close_token_account::execute(ctx, position_index)
    }

    pub fn remove_position_from_isolated_comet(
        ctx: Context<RemovePositionFromIsolatedComet>,
        position_index: u8,
    ) -> Result<()> {
        instructions::remove_position_from_isolated_comet::execute(ctx, position_index)
    }
}
