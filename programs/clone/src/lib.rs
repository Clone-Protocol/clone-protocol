use anchor_lang::prelude::*;
use error::*;
use rust_decimal::prelude::*;

pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod states;

use instructions::*;

declare_id!("6xmjJPzcUQHb7Dhii4EfqvP8UxanxWYwRSpVY4yAUa2g");

#[program]
pub mod clone {

    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_clone(
        ctx: Context<InitializeClone>,
        il_health_score_cutoff: u64,
        il_liquidation_reward_pct: u64,
        max_health_liquidation: u64,
        liquidator_fee: u64,
        treasury_address: Pubkey,
    ) -> Result<()> {
        instructions::initialize_clone::execute(
            ctx,
            il_health_score_cutoff,
            il_liquidation_reward_pct,
            max_health_liquidation,
            liquidator_fee,
            treasury_address,
        )
    }

    pub fn update_clone_parameters(
        ctx: Context<UpdateCloneParameters>,
        params: CloneParameters,
    ) -> Result<()> {
        instructions::update_clone_parameters::execute(ctx, params)
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

    pub fn initialize_comet(ctx: Context<InitializeComet>) -> Result<()> {
        instructions::initialize_comet::execute(ctx)
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

    pub fn mint_onusd(ctx: Context<MintONUSD>, amount: u64) -> Result<()> {
        instructions::mint_onusd::execute(ctx, amount)
    }

    pub fn burn_onusd(ctx: Context<BurnONUSD>, amount: u64) -> Result<()> {
        instructions::burn_onusd::execute(ctx, amount)
    }

    pub fn initialize_borrow_position(
        ctx: Context<InitializeBorrowPosition>,
        pool_index: u8,
        collateral_index: u8,
        onasset_amount: u64,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::initialize_borrow_position::execute(
            ctx,
            pool_index,
            collateral_index,
            onasset_amount,
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

    pub fn pay_borrow_debt(
        ctx: Context<PayBorrowDebt>,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::pay_borrow_debt::execute(ctx, borrow_index, amount)
    }

    pub fn borrow_more(ctx: Context<BorrowMore>, borrow_index: u8, amount: u64) -> Result<()> {
        instructions::borrow_more::execute(ctx, borrow_index, amount)
    }

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        collateral_index: u8,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::add_collateral_to_comet::execute(ctx, collateral_index, collateral_amount)
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
        onusd_amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity_to_comet::execute(ctx, pool_index, onusd_amount)
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

    pub fn liquidate_borrow_position(
        ctx: Context<LiquidateBorrowPosition>,
        borrow_index: u8,
    ) -> Result<()> {
        instructions::liquidate_borrow_position::execute(ctx, borrow_index)
    }

    pub fn collect_lp_rewards(
        ctx: Context<CollectLpRewards>,
        comet_position_index: u8,
    ) -> Result<()> {
        instructions::collect_lp_rewards::execute(ctx, comet_position_index)
    }

    pub fn pay_impermanent_loss_debt(
        ctx: Context<PayImpermanentLossDebt>,
        comet_position_index: u8,
        amount: u64,
        pay_onusd_debt: bool,
    ) -> Result<()> {
        instructions::pay_impermanent_loss_debt::execute(
            ctx,
            comet_position_index,
            amount,
            pay_onusd_debt,
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

    pub fn liquidate_comet_position(
        ctx: Context<LiquidateCometPosition>,
        comet_position_index: u8,
        amount: u64,
        pay_onusd_debt: bool,
    ) -> Result<()> {
        instructions::liquidate_comet_position::execute(
            ctx,
            comet_position_index,
            amount,
            pay_onusd_debt,
        )
    }

    pub fn close_comet_account(ctx: Context<CloseCometAccount>) -> Result<()> {
        instructions::close_comet_account::execute(ctx)
    }

    pub fn close_borrow_positions_account(ctx: Context<CloseBorrowPositionsAccount>) -> Result<()> {
        instructions::close_borrow_positions_account::execute(ctx)
    }

    pub fn close_user_account(ctx: Context<CloseUserAccount>) -> Result<()> {
        instructions::close_user_account::execute(ctx)
    }

    pub fn deprecate_pool(ctx: Context<DeprecatePool>, pool_index: u8) -> Result<()> {
        instructions::deprecate_pool::execute(ctx, pool_index)
    }

    pub fn wrap_asset(ctx: Context<WrapAsset>, amount: u64, pool_index: u8) -> Result<()> {
        instructions::wrap_asset::execute(ctx, amount, pool_index)
    }

    pub fn unwrap_onasset(ctx: Context<UnwrapOnAsset>, amount: u64, pool_index: u8) -> Result<()> {
        instructions::unwrap_onasset::execute(ctx, amount, pool_index)
    }

    pub fn remove_comet_position(
        ctx: Context<RemoveCometPosition>,
        comet_position_index: u8,
    ) -> Result<()> {
        instructions::remove_comet_position::execute(ctx, comet_position_index)
    }

    pub fn swap(
        ctx: Context<Swap>,
        pool_index: u8,
        quantity: u64,
        quantity_is_input: bool,
        quantity_is_onusd: bool,
        result_threshold: u64,
    ) -> Result<()> {
        instructions::swap::execute(
            ctx,
            pool_index,
            quantity,
            quantity_is_input,
            quantity_is_onusd,
            result_threshold,
        )
    }
}
