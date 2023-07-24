use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(
    max_health_liquidation: u64,
    liquidator_fee: u64,
    treasury_address: Pubkey,
)]
pub struct InitializeClone<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        space = 8 + 200,
        seeds = [b"clone"],
        bump,
        payer = admin
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = clone,
        payer = admin
    )]
    pub onusd_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = onusd_mint,
        token::authority = clone,
        payer = admin
    )]
    pub onusd_vault: Account<'info, TokenAccount>,
    /// CHECK:
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = usdc_mint,
        token::authority = clone,
        payer = admin
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(zero)]
    pub token_data: AccountLoader<'info, TokenData>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn execute(
    ctx: Context<InitializeClone>,
    max_health_liquidation: u64,
    liquidator_fee: u64,
    treasury_address: Pubkey,
) -> Result<()> {
    return_error_if_false!(max_health_liquidation < 100, CloneError::InvalidValueRange);
    return_error_if_false!(liquidator_fee < 10000, CloneError::InvalidValueRange);
    let mut token_data = ctx.accounts.token_data.load_init()?;

    // set manager data
    ctx.accounts.clone.token_data = *ctx.accounts.token_data.to_account_info().key;
    ctx.accounts.clone.onusd_mint = *ctx.accounts.onusd_mint.to_account_info().key;
    ctx.accounts.clone.admin = *ctx.accounts.admin.to_account_info().key;
    ctx.accounts.clone.bump = *ctx.bumps.get("clone").unwrap();
    ctx.accounts.clone.treasury_address = treasury_address;

    ctx.accounts.clone.liquidation_config = LiquidationConfig {
        max_health_liquidation: RawDecimal::new(max_health_liquidation.try_into().unwrap(), 0),
        liquidator_fee: RawDecimal::new(liquidator_fee.try_into().unwrap(), BPS_SCALE),
    };

    // add onusd as first collateral type
    token_data.append_collateral(Collateral {
        oracle_info_index: u64::MAX,
        mint: *ctx.accounts.onusd_mint.to_account_info().key,
        vault: *ctx.accounts.onusd_vault.to_account_info().key,
        vault_onusd_supply: RawDecimal::new(0, CLONE_TOKEN_SCALE),
        vault_mint_supply: RawDecimal::new(0, CLONE_TOKEN_SCALE),
        vault_comet_supply: RawDecimal::new(0, CLONE_TOKEN_SCALE),
        collateralization_ratio: RawDecimal::from(Decimal::one()),
        stable: 1,
        liquidation_discount: RawDecimal::new(0, CLONE_TOKEN_SCALE),
    });
    // add usdc as second collateral type
    let usdc_scale = ctx.accounts.usdc_mint.decimals;
    token_data.append_collateral(Collateral {
        oracle_info_index: u64::MAX,
        mint: *ctx.accounts.usdc_mint.to_account_info().key,
        vault: *ctx.accounts.usdc_vault.to_account_info().key,
        vault_onusd_supply: RawDecimal::new(0, usdc_scale.into()),
        vault_mint_supply: RawDecimal::new(0, usdc_scale.into()),
        vault_comet_supply: RawDecimal::new(0, usdc_scale.into()),
        collateralization_ratio: RawDecimal::from(Decimal::one()),
        stable: 1,
        liquidation_discount: RawDecimal::new(0, usdc_scale.into()),
    });

    // set token data
    token_data.clone = *ctx.accounts.clone.to_account_info().key;

    Ok(())
}
