use anchor_lang::prelude::*;

pub mod decimal;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod states;

use instructions::*;

declare_id!("F7KEvEhxAQ5AXKRSRHruSF55jcUxVv6S45ohkHvStd5v");

#[program]
pub mod clone {

    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_clone(
        ctx: Context<InitializeClone>,
        comet_collateral_ild_liquidator_fee_bps: u16,
        comet_onasset_ild_liquidator_fee_bps: u16,
        borrow_liquidator_fee_bps: u16,
        treasury_address: Pubkey,
    ) -> Result<()> {
        instructions::initialize_clone::execute(
            ctx,
            comet_collateral_ild_liquidator_fee_bps,
            comet_onasset_ild_liquidator_fee_bps,
            borrow_liquidator_fee_bps,
            treasury_address,
        )
    }

    pub fn initialize_pools(ctx: Context<InitializePools>) -> Result<()> {
        instructions::initialize_pools::execute(ctx)
    }

    pub fn initialize_oracles(ctx: Context<InitializeOracles>) -> Result<()> {
        instructions::initialize_oracles::execute(ctx)
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

    pub fn update_oracles(
        ctx: Context<UpdateOracles>,
        params: UpdateOracleParameters
    ) -> Result<()> {
        instructions::update_oracles::execute(ctx, params)
    }

    pub fn initialize_user(ctx: Context<InitializeUser>, authority: Pubkey) -> Result<()> {
        instructions::initialize_user::execute(ctx, authority)
    }

    pub fn add_pool(
        ctx: Context<AddPool>,
        min_overcollateral_ratio: u16,
        max_liquidation_overcollateral_ratio: u16,
        liquidity_trading_fee_bps: u16,
        treasury_trading_fee_bps: u16,
        il_health_score_coefficient: u16,
        position_health_score_coefficient: u16,
        oracle_info_index: u8,
    ) -> Result<()> {
        instructions::add_pool::execute(
            ctx,
            min_overcollateral_ratio,
            max_liquidation_overcollateral_ratio,
            liquidity_trading_fee_bps,
            treasury_trading_fee_bps,
            il_health_score_coefficient,
            position_health_score_coefficient,
            oracle_info_index,
        )
    }

    pub fn update_prices<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
        indices: OracleIndices,
    ) -> Result<()> {
        instructions::update_prices::execute(ctx, indices)
    }

    pub fn initialize_borrow_position(
        ctx: Context<InitializeBorrowPosition>,
        pool_index: u8,
        onasset_amount: u64,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::initialize_borrow_position::execute(
            ctx,
            pool_index,
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
        user: Pubkey,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::pay_borrow_debt::execute(ctx, user, borrow_index, amount)
    }

    pub fn borrow_more(ctx: Context<BorrowMore>, borrow_index: u8, amount: u64) -> Result<()> {
        instructions::borrow_more::execute(ctx, borrow_index, amount)
    }

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::add_collateral_to_comet::execute(ctx, collateral_amount)
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_collateral_from_comet::execute(ctx, collateral_amount)
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
        onusd_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_liquidity_from_comet::execute(
            ctx,
            comet_position_index,
            onusd_amount,
        )
    }

    pub fn liquidate_comet_collateral_ild(
        ctx: Context<LiquidateCometCollateralIld>,
        comet_position_index: u8,
    ) -> Result<()> {
        instructions::liquidate_comet_collateral_ild::execute(ctx, comet_position_index)
    }

    pub fn liquidate_comet_position(
        ctx: Context<LiquidateCometOnassetIld>,
        comet_position_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::liquidate_comet_onasset_ild::execute(ctx, comet_position_index, amount)
    }

    pub fn liquidate_borrow_position(
        ctx: Context<LiquidateBorrowPosition>,
        borrow_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::liquidate_borrow_position::execute(ctx, borrow_index, amount)
    }

    pub fn collect_lp_rewards(
        ctx: Context<CollectLpRewards>,
        comet_position_index: u8,
    ) -> Result<()> {
        instructions::collect_lp_rewards::execute(ctx, comet_position_index)
    }

    pub fn pay_impermanent_loss_debt(
        ctx: Context<PayImpermanentLossDebt>,
        user: Pubkey,
        comet_position_index: u8,
        amount: u64,
        payment_type: PaymentType,
    ) -> Result<()> {
        instructions::pay_impermanent_loss_debt::execute(
            ctx,
            user,
            comet_position_index,
            amount,
            payment_type,
        )
    }

    pub fn close_user_account(ctx: Context<CloseUserAccount>) -> Result<()> {
        instructions::close_user_account::execute(ctx)
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
