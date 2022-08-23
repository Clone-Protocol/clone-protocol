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
    pub admin: Signer<'info>,
    #[account(
        init,
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
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
    _manager_nonce: u8,
    _il_health_score_coefficient: u64,
    _il_health_score_cutoff: u64,
    _il_liquidation_reward_pct: u64,
) -> ProgramResult {
    require!(
        _il_health_score_coefficient > 0,
        InceptError::InvalidHealthScoreCoefficient
    );
    let mut token_data = ctx.accounts.token_data.load_init()?;

    // set manager data
    ctx.accounts.manager.token_data = *ctx.accounts.token_data.to_account_info().key;
    ctx.accounts.manager.usdi_mint = *ctx.accounts.usdi_mint.to_account_info().key;
    ctx.accounts.manager.admin = *ctx.accounts.admin.to_account_info().key;

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
        _il_health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.il_health_score_cutoff = RawDecimal::new(
        _il_health_score_cutoff.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.il_liquidation_reward_pct = RawDecimal::new(
        _il_liquidation_reward_pct.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
