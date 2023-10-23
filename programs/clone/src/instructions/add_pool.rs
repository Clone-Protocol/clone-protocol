use crate::decimal::CLONE_TOKEN_SCALE;
use crate::{error::*, return_error_if_false, states::*};
use crate::{CLONE_PROGRAM_SEED, POOLS_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(
    min_overcollateral_ratio: u16,
    max_liquidation_overcollateral_ratio: u16,
    liquidity_trading_fee_bps: u16,
    treasury_trading_fee_bps: u16,
    il_health_score_coefficient: u16,
    position_health_score_coefficient: u16,
    oracle_info_index: u8,
)]
pub struct AddPool<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mint::decimals = CLONE_TOKEN_SCALE as u8,
        mint::authority = clone,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        token::mint = onasset_mint,
        token::authority = clone,
    )]
    pub onasset_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: External mint address, can only be selected by admin.
    pub underlying_asset_mint: Box<Account<'info, Mint>>,
    #[account(
        token::mint = underlying_asset_mint,
        token::authority = clone,
    )]
    pub underlying_asset_token_account: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<AddPool>,
    min_overcollateral_ratio: u16,
    max_liquidation_overcollateral_ratio: u16,
    liquidity_trading_fee_bps: u16,
    treasury_trading_fee_bps: u16,
    il_health_score_coefficient: u16,
    position_health_score_coefficient: u16,
    oracle_info_index: u8,
) -> Result<()> {
    let asset_info = AssetInfo {
        onasset_mint: ctx.accounts.onasset_mint.to_account_info().key(),
        oracle_info_index,
        il_health_score_coefficient,
        position_health_score_coefficient,
        min_overcollateral_ratio,
        max_liquidation_overcollateral_ratio,
        ..AssetInfo::default()
    };
    return_error_if_false!(
        asset_info.is_valid_overcollateral_ratios(),
        CloneError::InvalidOvercollateralizationRatios
    );
    // append pool to list
    ctx.accounts.pools.pools.push(Pool {
        underlying_asset_token_account: ctx
            .accounts
            .underlying_asset_token_account
            .to_account_info()
            .key(),
        treasury_trading_fee_bps: treasury_trading_fee_bps.into(),
        liquidity_trading_fee_bps: liquidity_trading_fee_bps.into(),
        asset_info,
        status: Status::Active,
        committed_collateral_liquidity: 0,
        collateral_ild: 0,
        onasset_ild: 0,
    });

    Ok(())
}
