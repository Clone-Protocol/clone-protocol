use anchor_lang::prelude::*;
use error::*;
use rust_decimal::prelude::*;

pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod states;

use instructions::*;

declare_id!("5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1");

#[program]
pub mod incept {

    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_incept(
        ctx: Context<InitializeIncept>,
        il_health_score_cutoff: u64,
        il_liquidation_reward_pct: u64,
        max_health_liquidation: u64,
        liquidator_fee: u64,
        treasury_address: Pubkey,
    ) -> Result<()> {
        instructions::initialize_incept::execute(
            ctx,
            il_health_score_cutoff,
            il_liquidation_reward_pct,
            max_health_liquidation,
            liquidator_fee,
            treasury_address,
        )
    }

    pub fn update_incept_parameters(
        ctx: Context<UpdateInceptParameters>,
        params: InceptParameters,
    ) -> Result<()> {
        instructions::update_incept_parameters::execute(ctx, params)
    }

    pub fn update_pool_parameters(
        ctx: Context<UpdatePoolParameters>,
        index: u8,
        params: PoolParameters,
    ) -> Result<()> {
        instructions::update_pool_parameters::execute(ctx, index, params)
    }

    pub fn update_collateral_parameters(
        ctx: Context<UpdateCollateralParameters>,
        index: u8,
        params: CollateralParameters,
    ) -> Result<()> {
        instructions::update_collateral_parameters::execute(ctx, index, params)
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
        stable: bool,
        collateralization_ratio: u64,
        pool_index: u8,
    ) -> Result<()> {
        instructions::add_collateral::execute(
            ctx,
            scale,
            stable,
            collateralization_ratio,
            pool_index,
        )
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        stable_collateral_ratio: u16,
        crypto_collateral_ratio: u16,
        liquidity_trading_fee: u16,
        treasury_trading_fee: u16,
        il_health_score_coefficient: u64,
        position_health_score_coefficient: u64,
        liquidation_discount_rate: u64,
        max_ownership_pct: u64,
    ) -> Result<()> {
        instructions::initialize_pool::execute(
            ctx,
            stable_collateral_ratio,
            crypto_collateral_ratio,
            liquidity_trading_fee,
            treasury_trading_fee,
            il_health_score_coefficient,
            position_health_score_coefficient,
            liquidation_discount_rate,
            max_ownership_pct,
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

    pub fn burn_usdi(ctx: Context<BurnUSDI>, amount: u64) -> Result<()> {
        instructions::burn_usdi::execute(ctx, amount)
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
    ) -> Result<()> {
        instructions::withdraw_liquidity_from_comet::execute(
            ctx,
            comet_position_index,
            liquidity_token_amount,
        )
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
        amount: u64,
        pay_usdi_debt: bool,
    ) -> Result<()> {
        instructions::pay_impermanent_loss_debt::execute(
            ctx,
            comet_position_index,
            amount,
            pay_usdi_debt,
        )
    }

    pub fn liquidate_comet_nonstable_collateral(
        ctx: Context<LiquidateCometNonStableCollateral>,
        stable_swap_in_amount: u64,
        comet_nonstable_collateral_index: u8,
        comet_stable_collateral_index: u8,
    ) -> Result<()> {
        instructions::liquidate_comet_nonstable_collateral::execute(
            ctx,
            stable_swap_in_amount,
            comet_nonstable_collateral_index,
            comet_stable_collateral_index,
        )
    }

    pub fn liquidate_comet_stable_collateral(
        ctx: Context<LiquidateCometStableCollateral>,
        comet_collateral_index: u8,
    ) -> Result<()> {
        instructions::liquidate_comet_stable_collateral::execute(ctx, comet_collateral_index)
    }

    pub fn liquidate_comet_ild(
        ctx: Context<LiquidateCometILD>,
        comet_position_index: u8,
        amount: u64,
        pay_usdi_debt: bool,
    ) -> Result<()> {
        instructions::liquidate_comet_ild::execute(ctx, comet_position_index, amount, pay_usdi_debt)
    }

    pub fn liquidate_comet_borrow(
        ctx: Context<LiquidateCometBorrow>,
        comet_position_index: u8,
        liquidity_token_amount: u64,
    ) -> Result<()> {
        instructions::liquidate_comet_borrow::execute(
            ctx,
            comet_position_index,
            liquidity_token_amount,
        )
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

    pub fn wrap_asset(ctx: Context<WrapAsset>, amount: u64, pool_index: u8) -> Result<()> {
        instructions::wrap_asset::execute(ctx, amount, pool_index)
    }

    pub fn unwrap_iasset(ctx: Context<UnwrapIasset>, amount: u64, pool_index: u8) -> Result<()> {
        instructions::unwrap_iasset::execute(ctx, amount, pool_index)
    }

    pub fn remove_comet_position(
        ctx: Context<RemoveCometPosition>,
        comet_position_index: u8,
    ) -> Result<()> {
        instructions::remove_comet_position::execute(ctx, comet_position_index)
    }
}
