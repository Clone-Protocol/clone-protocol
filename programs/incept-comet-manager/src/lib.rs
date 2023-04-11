use anchor_lang::prelude::*;
mod config;
mod error;
mod instructions;
mod states;

use crate::instructions::*;

declare_id!("6HAQXsz7ScT5SueXukgDB8ExE9FKeqj5q1z925SujZsu");

#[program]
pub mod incept_comet_manager {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        user_bump: u8,
        withdrawal_fee_bps: u16,
        management_fee_bps: u16,
    ) -> Result<()> {
        initialize::execute(ctx, user_bump, withdrawal_fee_bps, management_fee_bps)
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

    pub fn redeem_from_closed_manager(ctx: Context<RedeemFromClosingManager>) -> Result<()> {
        redeem_from_closing_manager::execute(ctx)
    }

    pub fn request_redemption(
        ctx: Context<RequestRedemption>,
        membership_tokens_to_redeem: u64,
    ) -> Result<()> {
        request_redemption::execute(ctx, membership_tokens_to_redeem)
    }

    pub fn fulfill_redemption_request(
        ctx: Context<FulfillRedemptionRequest>,
        index: u8,
    ) -> Result<()> {
        fulfill_redemption_request::execute(ctx, index)
    }

    pub fn assign_redemption_strike(ctx: Context<AssignRedemptionStrike>, index: u8) -> Result<()> {
        assign_redemption_strike::execute(ctx, index)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        pool_index: u8,
        usdi_amount: u64,
    ) -> Result<()> {
        add_liquidity::execute(ctx, pool_index, usdi_amount)
    }

    pub fn add_collateral_to_comet(ctx: Context<AddCollateralToComet>, amount: u64) -> Result<()> {
        add_collateral_to_comet::execute(ctx, amount)
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        amount: u64,
    ) -> Result<()> {
        withdraw_collateral_from_comet::execute(ctx, amount)
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        comet_position_index: u8,
        liquidity_token_amount: u64,
    ) -> Result<()> {
        withdraw_liquidity::execute(ctx, comet_position_index, liquidity_token_amount)
    }

    pub fn pay_ild(
        ctx: Context<PayIld>,
        comet_position_index: u8,
        collateral_amount: u64,
        pay_usdi_debt: bool,
    ) -> Result<()> {
        pay_ild::execute(ctx, comet_position_index, collateral_amount, pay_usdi_debt)
    }

    pub fn remove_comet_position(
        ctx: Context<RemoveCometPosition>,
        comet_position_index: u8,
    ) -> Result<()> {
        remove_comet_position::execute(ctx, comet_position_index)
    }

    pub fn owner_withdrawal(ctx: Context<OwnerWithdrawal>, usdi_amount: u64) -> Result<()> {
        owner_withdrawal::execute(ctx, usdi_amount)
    }

    pub fn initiate_comet_manager_closing(ctx: Context<InitiateCometManagerClosing>) -> Result<()> {
        initiate_comet_manager_closing::execute(ctx)
    }

    pub fn close_comet_manager(ctx: Context<CloseCometManager>) -> Result<()> {
        close_comet_manager::execute(ctx)
    }

    pub fn burn_usdi(ctx: Context<BurnUSDI>, amount: u64) -> Result<()> {
        burn_usdi::execute(ctx, amount)
    }

    pub fn mint_usdi(ctx: Context<MintUSDI>, amount: u64) -> Result<()> {
        mint_usdi::execute(ctx, amount)
    }

    pub fn wrap_asset(ctx: Context<WrapAsset>, amount: u64, pool_index: u8) -> Result<()> {
        wrap_asset::execute(ctx, amount, pool_index)
    }

    pub fn unwrap_iasset(ctx: Context<UnwrapIasset>, amount: u64, pool_index: u8) -> Result<()> {
        unwrap_iasset::execute(ctx, amount, pool_index)
    }

    pub fn incept_swap(
        ctx: Context<InceptSwap>,
        is_buy: bool,
        pool_index: u8,
        amount: u64,
        usdi_threshold: u64,
    ) -> Result<()> {
        incept_swap::execute(ctx, is_buy, pool_index, amount, usdi_threshold)
    }

    pub fn jupiter_mock_swap(
        ctx: Context<JupiterMockSwap>,
        jupiter_nonce: u8,
        is_buy: bool,
        asset_index: u8,
        amount: u64,
    ) -> Result<()> {
        jupiter_mock_swap::execute(ctx, jupiter_nonce, is_buy, asset_index, amount)
    }
}
