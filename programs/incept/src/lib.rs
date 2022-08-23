use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use error::*;
use instructions::*;
use rust_decimal::prelude::*;

mod error;
mod instructions;
mod math;
mod procedures;
mod states;
mod value;

declare_id!("3j5wcCkkjns9wibgXVNAay3gzjZiVvYUbW66vqvjEaS7");

#[program]
pub mod incept {
    use super::*;

    pub fn initialize_manager(
        ctx: Context<InitializeManager>,
        manager_nonce: u8,
        il_health_score_coefficient: u64,
        il_health_score_cutoff: u64,
        il_liquidation_reward_pct: u64,
    ) -> ProgramResult {
        procedures::initialize_manager::execute(
            ctx,
            manager_nonce,
            il_health_score_coefficient,
            il_health_score_cutoff,
            il_liquidation_reward_pct,
        )
    }

    pub fn update_il_health_score_coefficient(
        ctx: Context<UpdateILHealthScoreCoefficient>,
        manager_nonce: u8,
        il_health_score_coefficient: u64,
    ) -> ProgramResult {
        procedures::update_il_health_score_coefficient::execute(
            ctx,
            manager_nonce,
            il_health_score_coefficient,
        )
    }

    pub fn initialize_user(ctx: Context<InitializeUser>, user_nonce: u8) -> ProgramResult {
        procedures::initialize_user::execute(ctx, user_nonce)
    }

    pub fn initialize_single_pool_comets(
        ctx: Context<InitializeSinglePoolComets>,
        user_nonce: u8,
    ) -> ProgramResult {
        procedures::initialize_single_pool_comets::execute(ctx, user_nonce)
    }

    pub fn initialize_mint_positions(
        ctx: Context<InitializeMintPositions>,
        user_nonce: u8,
    ) -> ProgramResult {
        procedures::initialize_mint_positions::execute(ctx, user_nonce)
    }

    pub fn initialize_liquidity_positions(
        ctx: Context<InitializeLiquidityPositions>,
        user_nonce: u8,
    ) -> ProgramResult {
        procedures::initialize_liquidity_positions::execute(ctx, user_nonce)
    }

    pub fn initialize_comet(ctx: Context<InitializeComet>, user_nonce: u8) -> ProgramResult {
        procedures::initialize_comet::execute(ctx, user_nonce)
    }

    pub fn add_collateral(
        ctx: Context<AddCollateral>,
        manager_nonce: u8,
        scale: u8,
        stable: u8,
        collateralization_ratio: u64,
    ) -> ProgramResult {
        procedures::add_collateral::execute(
            ctx,
            manager_nonce,
            scale,
            stable,
            collateralization_ratio,
        )
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        manager_nonce: u8,
        stable_collateral_ratio: u16,
        crypto_collateral_ratio: u16,
        liquidity_trading_fee: u16,
        health_score_coefficient: u64,
    ) -> ProgramResult {
        procedures::initialize_pool::execute(
            ctx,
            manager_nonce,
            stable_collateral_ratio,
            crypto_collateral_ratio,
            liquidity_trading_fee,
            health_score_coefficient,
        )
    }

    pub fn update_pool_health_score_coefficient(
        ctx: Context<UpdatePoolHealthScore>,
        manager_nonce: u8,
        pool_index: u8,
        health_score_coefficient: u64,
    ) -> ProgramResult {
        procedures::update_pool_health_score_coefficient::execute(
            ctx,
            manager_nonce,
            pool_index,
            health_score_coefficient,
        )
    }

    pub fn update_prices<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
        manager_nonce: u8,
    ) -> ProgramResult {
        procedures::update_prices::execute(ctx, manager_nonce)
    }

    pub fn mint_usdi(ctx: Context<MintUSDI>, manager_nonce: u8, amount: u64) -> ProgramResult {
        procedures::mint_usdi::execute(ctx, manager_nonce, amount)
    }

    pub fn initialize_mint_position(
        ctx: Context<InitializeMintPosition>,
        manager_nonce: u8,
        iasset_amount: u64,
        collateral_amount: u64,
    ) -> ProgramResult {
        procedures::initialize_mint_position::execute(
            ctx,
            manager_nonce,
            iasset_amount,
            collateral_amount,
        )
    }

    pub fn add_collateral_to_mint(
        ctx: Context<AddCollateralToMint>,
        manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        procedures::add_collateral_to_mint::execute(ctx, manager_nonce, mint_index, amount)
    }

    pub fn withdraw_collateral_from_mint(
        ctx: Context<WithdrawCollateralFromMint>,
        manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        procedures::withdraw_collateral_from_mint::execute(ctx, manager_nonce, mint_index, amount)
    }

    pub fn pay_back_mint(
        ctx: Context<PayBackiAssetToMint>,
        manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        procedures::pay_back_mint::execute(ctx, manager_nonce, mint_index, amount)
    }

    pub fn add_iasset_to_mint(
        ctx: Context<AddiAssetToMint>,
        manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        procedures::add_iasset_to_mint::execute(ctx, manager_nonce, mint_index, amount)
    }

    pub fn initialize_liquidity_position(
        ctx: Context<InitializeLiquidityPosition>,
        manager_nonce: u8,
        pool_index: u8,
        iasset_amount: u64,
    ) -> ProgramResult {
        procedures::initialize_liquidity_position::execute(
            ctx,
            manager_nonce,
            pool_index,
            iasset_amount,
        )
    }

    pub fn provide_liquidity(
        ctx: Context<ProvideLiquidity>,
        manager_nonce: u8,
        liquidity_position_index: u8,
        iasset_amount: u64,
    ) -> ProgramResult {
        procedures::provide_liquidity::execute(
            ctx,
            manager_nonce,
            liquidity_position_index,
            iasset_amount,
        )
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        manager_nonce: u8,
        liquidity_position_index: u8,
        liquidity_token_amount: u64,
    ) -> ProgramResult {
        procedures::withdraw_liquidity::execute(
            ctx,
            manager_nonce,
            liquidity_position_index,
            liquidity_token_amount,
        )
    }

    pub fn buy_synth(
        ctx: Context<BuySynth>,
        manager_nonce: u8,
        pool_index: u8,
        amount: u64,
    ) -> ProgramResult {
        procedures::buy_synth::execute(ctx, manager_nonce, pool_index, amount)
    }

    pub fn sell_synth(
        ctx: Context<SellSynth>,
        manager_nonce: u8,
        pool_index: u8,
        amount: u64,
    ) -> ProgramResult {
        procedures::sell_synth::execute(ctx, manager_nonce, pool_index, amount)
    }

    pub fn initialize_single_pool_comet(
        ctx: Context<InitializeSinglePoolComet>,
        manager_nonce: u8,
        pool_index: u8,
    ) -> ProgramResult {
        procedures::initialize_single_pool_comet::execute(ctx, manager_nonce, pool_index)
    }

    pub fn close_single_pool_comet(
        ctx: Context<CloseSinglePoolComet>,
        user_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        procedures::close_single_pool_comet::execute(ctx, user_nonce, comet_index)
    }

    pub fn initialize_comet_manager(
        ctx: Context<InitializeCometManager>,
        manager_nonce: u8,
        user_nonce: u8,
    ) -> ProgramResult {
        procedures::initialize_comet_manager::execute(ctx, manager_nonce, user_nonce)
    }

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        manager_nonce: u8,
        collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        procedures::add_collateral_to_comet::execute(
            ctx,
            manager_nonce,
            collateral_index,
            collateral_amount,
        )
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        manager_nonce: u8,
        user_nonce: u8,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        procedures::withdraw_collateral_from_comet::execute(
            ctx,
            manager_nonce,
            user_nonce,
            comet_collateral_index,
            collateral_amount,
        )
    }

    pub fn add_liquidity_to_comet(
        ctx: Context<AddLiquidityToComet>,
        manager_nonce: u8,
        pool_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        procedures::add_liquidity_to_comet::execute(ctx, manager_nonce, pool_index, usdi_amount)
    }

    pub fn withdraw_liquidity_from_comet(
        ctx: Context<WithdrawLiquidityFromComet>,
        manager_nonce: u8,
        comet_position_index: u8,
        liquidity_token_amount: u64,
    ) -> ProgramResult {
        procedures::withdraw_liquidity_from_comet::execute(
            ctx,
            manager_nonce,
            comet_position_index,
            liquidity_token_amount,
        )
    }

    pub fn withdraw_liquidity_from_single_pool_comet(
        ctx: Context<WithdrawLiquidityFromSinglePoolComet>,
        manager_nonce: u8,
        liquidity_token_amount: u64,
    ) -> ProgramResult {
        procedures::withdraw_liquidity_from_single_pool_comet::execute(
            ctx,
            manager_nonce,
            liquidity_token_amount,
        )
    }

    pub fn recenter_comet(
        ctx: Context<RecenterComet>,
        manager_nonce: u8,
        comet_position_index: u8,
        comet_collateral_index: u8,
    ) -> ProgramResult {
        procedures::recenter_comet::execute(
            ctx,
            manager_nonce,
            comet_position_index,
            comet_collateral_index,
        )
    }

    pub fn mint_usdi_hackathon(
        ctx: Context<MintUSDIHackathon>,
        manager_nonce: u8,
        amount: u64,
    ) -> ProgramResult {
        //This instruction is for hackathon use ONLY!!!!
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        // mint usdi to user
        let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx_mint, amount)?;

        Ok(())
    }

    pub fn liquidate_mint_position(
        ctx: Context<LiquidateMintPosition>,
        manager_nonce: u8,
        mint_index: u8,
    ) -> ProgramResult {
        procedures::liquidate_mint_position::execute(ctx, manager_nonce, mint_index)
    }

    pub fn liquidate_comet_position_reduction(
        ctx: Context<LiquidateCometPositionReduction>,
        manager_nonce: u8,
        user_nonce: u8,
        position_index: u8,
        lp_token_reduction: u64,
    ) -> ProgramResult {
        procedures::liquidate_comet_position_reduction::execute(
            ctx,
            manager_nonce,
            user_nonce,
            position_index,
            lp_token_reduction,
        )
    }

    pub fn liquidate_comet_il_reduction(
        ctx: Context<LiquidateCometILReduction>,
        manager_nonce: u8,
        user_nonce: u8,
        jupiter_nonce: u8,
        position_index: u8,
        asset_index: u8,
        comet_collateral_index: u8,
        il_reduction_amount: u64,
    ) -> ProgramResult {
        procedures::liquidate_comet_il_reduction::execute(
            ctx,
            manager_nonce,
            user_nonce,
            jupiter_nonce,
            position_index,
            asset_index,
            comet_collateral_index,
            il_reduction_amount,
        )
    }

    pub fn pay_impermanent_loss_debt(
        ctx: Context<PayImpermanentLossDebt>,
        manager_nonce: u8,
        comet_position_index: u8,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        procedures::pay_impermanent_loss_debt::execute(
            ctx,
            manager_nonce,
            comet_position_index,
            comet_collateral_index,
            collateral_amount,
        )
    }
}
