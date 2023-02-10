use anchor_lang::prelude::*;
use error::*;
use rust_decimal::prelude::*;

pub mod error;
pub mod instructions;
pub mod math;
pub mod states;

use instructions::*;

declare_id!("2YSThxfPwJWYPAeBczUqbu2cyefjq9vAdDsPJU7PUVak");

#[program]
pub mod incept {

    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_incept(
        ctx: Context<InitializeIncept>,
        il_health_score_coefficient: u64,
        il_health_score_cutoff: u64,
        il_liquidation_reward_pct: u64,
        max_health_liquidation: u64,
        liquidator_fee: u64,
        collateral_full_liquidation_threshold: u64,
        treasury_address: Pubkey,
    ) -> Result<()> {
        instructions::initialize_incept::execute(
            ctx,
            il_health_score_coefficient,
            il_health_score_cutoff,
            il_liquidation_reward_pct,
            max_health_liquidation,
            liquidator_fee,
            collateral_full_liquidation_threshold,
            treasury_address,
        )
    }

    pub fn update_il_health_score_coefficient(
        ctx: Context<UpdateILHealthScoreCoefficient>,
        il_health_score_coefficient: u64,
    ) -> Result<()> {
        instructions::update_il_health_score_coefficient::execute(ctx, il_health_score_coefficient)
    }

    pub fn initialize_user(ctx: Context<InitializeUser>, authority: Pubkey) -> Result<()> {
        instructions::initialize_user::execute(ctx, authority)
    }

    pub fn initialize_borrow_positions(ctx: Context<InitializeBorrowPositions>) -> Result<()> {
        instructions::initialize_borrow_positions::execute(ctx)
    }

    pub fn initialize_comet(ctx: Context<InitializeComet>, is_single_pool: bool) -> Result<()> {
        instructions::initialize_comet::execute(ctx, is_single_pool)
    }

    pub fn add_collateral(
        ctx: Context<AddCollateral>,
        scale: u8,
        stable: u8,
        collateralization_ratio: u64,
    ) -> Result<()> {
        instructions::add_collateral::execute(ctx, scale, stable, collateralization_ratio)
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        stable_collateral_ratio: u16,
        crypto_collateral_ratio: u16,
        liquidity_trading_fee: u16,
        treasury_trading_fee: u16,
        health_score_coefficient: u64,
        liquidation_discount_rate: u64,
        max_ownership_pct: u64,
    ) -> Result<()> {
        instructions::initialize_pool::execute(
            ctx,
            stable_collateral_ratio,
            crypto_collateral_ratio,
            liquidity_trading_fee,
            treasury_trading_fee,
            health_score_coefficient,
            liquidation_discount_rate,
            max_ownership_pct,
        )
    }

    pub fn update_pool_health_score_coefficient(
        ctx: Context<UpdatePoolHealthScore>,
        pool_index: u8,
        health_score_coefficient: u64,
    ) -> Result<()> {
        instructions::update_pool_health_score_coefficient::execute(
            ctx,
            pool_index,
            health_score_coefficient,
        )
    }

    pub fn update_prices<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
        pool_indices: PoolIndices,
    ) -> Result<()> {
        instructions::update_prices::execute(ctx, pool_indices)
    }

    pub fn mint_usdi(ctx: Context<MintUSDI>, amount: u64) -> Result<()> {
        instructions::mint_usdi::execute(ctx, amount)
    }

    pub fn initialize_borrow_position(
        ctx: Context<InitializeBorrowPosition>,
        pool_index: u8,
        collateral_index: u8,
        iasset_amount: u64,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::initialize_borrow_position::execute(
            ctx,
            pool_index,
            collateral_index,
            iasset_amount,
            collateral_amount,
        )
    }

    pub fn add_collateral_to_borrow(
        ctx: Context<AddCollateralToBorrow>,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::add_collateral_to_borrow::execute(ctx, borrow_index, amount)
    }

    pub fn withdraw_collateral_from_borrow(
        ctx: Context<WithdrawCollateralFromBorrow>,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_collateral_from_borrow::execute(ctx, borrow_index, amount)
    }

    pub fn subtract_iasset_from_borrow(
        ctx: Context<SubtractiAssetFromBorrow>,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::subtract_iasset_from_borrow::execute(ctx, borrow_index, amount)
    }

    pub fn add_iasset_to_borrow(
        ctx: Context<AddiAssetToBorrow>,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::add_iasset_to_borrow::execute(ctx, borrow_index, amount)
    }

    pub fn provide_unconcentrated_liquidity(
        ctx: Context<ProvideUnconcentratedLiquidity>,
        liquidity_position_index: u8,
        iasset_amount: u64,
    ) -> Result<()> {
        instructions::provide_unconcentrated_liquidity::execute(
            ctx,
            liquidity_position_index,
            iasset_amount,
        )
    }

    pub fn withdraw_unconcentrated_liquidity(
        ctx: Context<WithdrawUnconcentratedLiquidity>,
        liquidity_position_index: u8,
        liquidity_token_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_unconcentrated_liquidity::execute(
            ctx,
            liquidity_position_index,
            liquidity_token_amount,
        )
    }

    pub fn buy_iasset(
        ctx: Context<BuyIasset>,
        pool_index: u8,
        amount: u64,
        usdi_spend_threshold: u64,
    ) -> Result<()> {
        instructions::buy_iasset::execute(ctx, pool_index, amount, usdi_spend_threshold)
    }

    pub fn sell_iasset(
        ctx: Context<SellIasset>,
        pool_index: u8,
        amount: u64,
        usdi_received_threshold: u64,
    ) -> Result<()> {
        instructions::sell_iasset::execute(ctx, pool_index, amount, usdi_received_threshold)
    }

    pub fn initialize_single_pool_comet(
        ctx: Context<InitializeSinglePoolComet>,
        pool_index: u8,
        collateral_index: u8,
    ) -> Result<()> {
        instructions::initialize_single_pool_comet::execute(ctx, pool_index, collateral_index)
    }

    pub fn close_single_pool_comet(
        ctx: Context<CloseSinglePoolComet>,
        comet_index: u8,
    ) -> Result<()> {
        instructions::close_single_pool_comet::execute(ctx, comet_index)
    }

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        collateral_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::add_collateral_to_comet::execute(ctx, collateral_index, collateral_amount)
    }

    pub fn add_collateral_to_single_pool_comet(
        ctx: Context<AddCollateralToSinglePoolComet>,
        position_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::add_collateral_to_single_pool_comet::execute(
            ctx,
            position_index,
            collateral_amount,
        )
    }

    pub fn withdraw_collateral_from_single_pool_comet(
        ctx: Context<WithdrawCollateralFromSinglePoolComet>,
        position_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_collateral_from_single_pool_comet::execute(
            ctx,
            position_index,
            collateral_amount,
        )
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_collateral_from_comet::execute(
            ctx,
            comet_collateral_index,
            collateral_amount,
        )
    }

    pub fn add_liquidity_to_comet(
        ctx: Context<AddLiquidityToComet>,
        pool_index: u8,
        usdi_amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity_to_comet::execute(ctx, pool_index, usdi_amount)
    }

    pub fn add_liquidity_to_single_pool_comet(
        ctx: Context<AddLiquidityToSinglePoolComet>,
        position_index: u8,
        usdi_amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity_to_single_pool_comet::execute(ctx, position_index, usdi_amount)
    }

    pub fn withdraw_liquidity_from_comet(
        ctx: Context<WithdrawLiquidityFromComet>,
        comet_position_index: u8,
        liquidity_token_amount: u64,
        comet_collateral_index: u8,
    ) -> Result<()> {
        instructions::withdraw_liquidity_from_comet::execute(
            ctx,
            comet_position_index,
            liquidity_token_amount,
            comet_collateral_index,
        )
    }

    pub fn withdraw_liquidity_from_single_pool_comet(
        ctx: Context<WithdrawLiquidityFromSinglePoolComet>,
        liquidity_token_amount: u64,
        position_index: u8,
    ) -> Result<()> {
        instructions::withdraw_liquidity_from_single_pool_comet::execute(
            ctx,
            liquidity_token_amount,
            position_index,
        )
    }

    pub fn recenter_comet(
        ctx: Context<RecenterComet>,
        comet_position_index: u8,
        comet_collateral_index: u8,
    ) -> Result<()> {
        instructions::recenter_comet::execute(ctx, comet_position_index, comet_collateral_index)
    }

    pub fn mint_usdi_hackathon(ctx: Context<MintUSDIHackathon>, amount: u64) -> Result<()> {
        instructions::mint_usdi_hackathon::execute(ctx, amount)
    }

    pub fn liquidate_borrow_position(
        ctx: Context<LiquidateBorrowPosition>,
        borrow_index: u8,
    ) -> Result<()> {
        instructions::liquidate_borrow_position::execute(ctx, borrow_index)
    }

    pub fn pay_impermanent_loss_debt(
        ctx: Context<PayImpermanentLossDebt>,
        comet_position_index: u8,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::pay_impermanent_loss_debt::execute(
            ctx,
            comet_position_index,
            comet_collateral_index,
            collateral_amount,
        )
    }

    pub fn liquidate_single_pool_comet(
        ctx: Context<LiquidateComet>,
        position_index: u8,
    ) -> Result<()> {
        return_error_if_false!(
            ctx.accounts.comet.load()?.is_single_pool == 1,
            InceptError::WrongCometType
        );
        instructions::liquidate_comet::execute(ctx, position_index, position_index)
    }

    pub fn swap_nonstable_collateral(
        ctx: Context<SwapCometNonStableCollateral>,
        stable_swap_in_amount: u64,
        comet_nonstable_collateral_index: u8,
        comet_stable_collateral_index: u8,
    ) -> Result<()> {
        instructions::swap_comet_nonstable_collateral::execute(
            ctx,
            stable_swap_in_amount,
            comet_nonstable_collateral_index,
            comet_stable_collateral_index,
        )
    }

    pub fn swap_stable_collateral_into_usdi(
        ctx: Context<SwapStableCollateralIntoUsdi>,
        comet_collateral_index: u8,
    ) -> Result<()> {
        instructions::swap_stable_collateral_into_usdi::execute(ctx, comet_collateral_index)
    }

    pub fn liquidate_comet(ctx: Context<LiquidateComet>, position_index: u8) -> Result<()> {
        return_error_if_false!(
            ctx.accounts.comet.load()?.is_single_pool == 0,
            InceptError::WrongCometType
        );
        instructions::liquidate_comet::execute(ctx, position_index, 0)
    }

    pub fn close_comet_account(ctx: Context<CloseCometAccount>) -> Result<()> {
        instructions::close_comet_account::execute(ctx)
    }

    pub fn close_single_pool_comet_account(
        ctx: Context<CloseSinglePoolCometAccount>,
    ) -> Result<()> {
        instructions::close_single_pool_comet_account::execute(ctx)
    }

    pub fn close_borrow_positions_account(ctx: Context<CloseBorrowPositionsAccount>) -> Result<()> {
        instructions::close_borrow_positions_account::execute(ctx)
    }

    pub fn close_user_account(ctx: Context<CloseUserAccount>) -> Result<()> {
        instructions::close_user_account::execute(ctx)
    }

    pub fn remove_pool(
        ctx: Context<RemovePool>,
        pool_index: u8,
        force_removal: bool,
    ) -> Result<()> {
        instructions::remove_pool::execute(ctx, pool_index, force_removal)
    }
}
