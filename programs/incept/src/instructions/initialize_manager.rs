use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use rust_decimal::prelude::*;
use std::convert::TryInto;

////use crate::instructions::InitializeManager;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, il_health_score_coefficient: u64, il_health_score_cutoff: u64, il_liquidation_reward_pct: u64)]
pub struct InitializeManager<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        space = 8 + 200,
        seeds = [b"manager"],
        bump,
        payer = admin
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = manager,
        payer = admin
    )]
    pub usdi_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = usdi_mint,
        token::authority = manager,
        payer = admin
    )]
    pub usdi_vault: Account<'info, TokenAccount>,
    #[account(zero)]
    pub token_data: AccountLoader<'info, TokenData>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub chainlink_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializeManager>,
    il_health_score_coefficient: u64,
    il_health_score_cutoff: u64,
    il_liquidation_reward_pct: u64,
    max_health_liquidation: u64,
    liquidator_fee: u64,
    collateral_full_liquidation_threshold: u64,
) -> Result<()> {
    require!(max_health_liquidation < 100, InceptError::InvalidValueRange);
    require!(liquidator_fee < 10000, InceptError::InvalidValueRange);
    let mut token_data = ctx.accounts.token_data.load_init()?;

    // set manager data
    ctx.accounts.manager.token_data = *ctx.accounts.token_data.to_account_info().key;
    ctx.accounts.manager.usdi_mint = *ctx.accounts.usdi_mint.to_account_info().key;
    ctx.accounts.manager.admin = *ctx.accounts.admin.to_account_info().key;
    ctx.accounts.manager.bump = *ctx.bumps.get("manager").unwrap();

    ctx.accounts.manager.liquidation_config = LiquidationConfig {
        max_health_liquidation: RawDecimal::new(max_health_liquidation.try_into().unwrap(), 0),
        liquidator_fee: RawDecimal::new(liquidator_fee.try_into().unwrap(), 4),
        collateral_full_liquidation_threshold: RawDecimal::new(
            collateral_full_liquidation_threshold.try_into().unwrap(),
            0,
        ),
    };

    // add usdi as first collateral type
    token_data.append_collateral(Collateral {
        pool_index: u8::MAX.into(),
        mint: *ctx.accounts.usdi_mint.to_account_info().key,
        vault: *ctx.accounts.usdi_vault.to_account_info().key,
        vault_usdi_supply: RawDecimal::new(0, DEVNET_TOKEN_SCALE),
        vault_mint_supply: RawDecimal::new(0, DEVNET_TOKEN_SCALE),
        vault_comet_supply: RawDecimal::new(0, DEVNET_TOKEN_SCALE),
        collateralization_ratio: RawDecimal::from(Decimal::one()),
        stable: 1,
    });
    token_data.num_collaterals = 1;

    // set token data
    token_data.manager = *ctx.accounts.manager.to_account_info().key;
    token_data.chainlink_program = *ctx.accounts.chainlink_program.to_account_info().key;
    token_data.il_health_score_coefficient = RawDecimal::new(
        il_health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.il_health_score_cutoff = RawDecimal::new(
        il_health_score_cutoff.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.il_liquidation_reward_pct = RawDecimal::new(
        il_liquidation_reward_pct.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
