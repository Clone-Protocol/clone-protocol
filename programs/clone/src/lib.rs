use anchor_lang::prelude::*;
use error::*;
use rust_decimal::prelude::*;

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
        liquidator_fee_bps: u16,
        treasury_address: Pubkey,
    ) -> Result<()> {
        instructions::initialize_clone::execute(ctx, liquidator_fee_bps, treasury_address)
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

    pub fn add_collateral(
        ctx: Context<AddCollateral>,
        scale: u8,
        collateralization_ratio: u8,
        oracle_info_index: u8,
    ) -> Result<()> {
        instructions::add_collateral::execute(
            ctx,
            scale,
            collateralization_ratio,
            oracle_info_index,
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
        oracle_info_index: u8,
    ) -> Result<()> {
        instructions::initialize_pool::execute(
            ctx,
            stable_collateral_ratio,
            crypto_collateral_ratio,
            liquidity_trading_fee,
            treasury_trading_fee,
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
        onusd_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_liquidity_from_comet::execute(
            ctx,
            comet_position_index,
            onusd_amount,
        )
    }

    pub fn liquidate_comet_position(
        ctx: Context<LiquidateCometPosition>,
        comet_position_index: u8,
        comet_collateral_index: u8,
        amount: u64,
        pay_onusd_debt: bool,
    ) -> Result<()> {
        instructions::liquidate_comet_position::execute(
            ctx,
            comet_position_index,
            comet_collateral_index,
            amount,
            pay_onusd_debt,
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
        user: Pubkey,
        comet_position_index: u8,
        amount: u64,
        pay_onusd_debt: bool,
    ) -> Result<()> {
        instructions::pay_impermanent_loss_debt::execute(
            ctx,
            user,
            comet_position_index,
            amount,
            pay_onusd_debt,
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

    pub fn add_oracle_feed(ctx: Context<AddOracleFeed>, pyth_address: Pubkey) -> Result<()> {
        instructions::add_oracle_feed::execute(ctx, pyth_address)
    }

    pub fn remove_oracle_feed(ctx: Context<RemoveOracleFeed>, index: u8) -> Result<()> {
        instructions::remove_oracle_feed::execute(ctx, index)
    }
}
