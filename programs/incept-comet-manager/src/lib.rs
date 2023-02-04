use anchor_lang::prelude::*;
mod instructions;
mod states;

use crate::instructions::*;

declare_id!("9UUKudw6whsFzWRxvyxQ1Ztet8cTqpHJJ5WpUfSbATYt");

#[program]
pub mod incept_comet_manager {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        user_bump: u8,
        health_score_threshold: u8,
        withdrawal_fee_bps: u16,
        management_fee_bps: u16,
    ) -> Result<()> {
        initialize::execute(
            ctx,
            user_bump,
            health_score_threshold,
            withdrawal_fee_bps,
            management_fee_bps,
        )
    }

    pub fn management_fee_claim(ctx: Context<ManagementFeeClaim>) -> Result<()> {
        management_fee_claim::execute(ctx)
    }

    pub fn initialize_subscription(ctx: Context<InitializeSubscription>) -> Result<()> {
        initialize_subscription::execute(ctx)
    }

    pub fn subscribe(ctx: Context<Subscribe>, usdi_collateral_to_provide: u64) -> Result<()> {
        subscribe::execute(ctx, usdi_collateral_to_provide)
    }

    pub fn redeem(ctx: Context<Redeem>, membership_tokens_to_redeem: u64) -> Result<()> {
        redeem::execute(ctx, membership_tokens_to_redeem)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        pool_index: u8,
        usdi_amount: u64,
    ) -> Result<()> {
        add_liquidity::execute(ctx, pool_index, usdi_amount)
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        comet_position_index: u8,
        liquidity_token_amount: u64,
    ) -> Result<()> {
        withdraw_liquidity::execute(ctx, comet_position_index, liquidity_token_amount)
    }

    pub fn recenter(ctx: Context<Recenter>, comet_position_index: u8) -> Result<()> {
        recenter::execute(ctx, comet_position_index)
    }

    pub fn pay_ild(
        ctx: Context<PayIld>,
        comet_position_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        pay_ild::execute(ctx, comet_position_index, collateral_amount)
    }

    pub fn owner_withdrawal(ctx: Context<OwnerWithdrawal>, usdi_amount: u64) -> Result<()> {
        owner_withdrawal::execute(ctx, usdi_amount)
    }

    pub fn initiate_comet_manager_termination(
        ctx: Context<InitiateCometManagerTermination>,
    ) -> Result<()> {
        initiate_comet_manager_termination::execute(ctx)
    }

    pub fn terminate_comet_manager(ctx: Context<TerminateCometManager>) -> Result<()> {
        terminate_comet_manager::execute(ctx)
    }
}
