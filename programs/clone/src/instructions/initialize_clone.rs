use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use std::convert::TryInto;

pub const CLONE_PROGRAM_SEED: &str = "clone";

#[derive(Accounts)]
#[instruction(
    liquidator_fee_bps: u16,
    treasury_address: Pubkey,
)]
pub struct InitializeClone<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        space = 8 + 489,
        bump,
        payer = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
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
    liquidator_fee_bps: u16,
    treasury_address: Pubkey,
) -> Result<()> {
    let mut token_data = ctx.accounts.token_data.load_init()?;

    // set manager data
    ctx.accounts.clone.token_data = *ctx.accounts.token_data.to_account_info().key;
    ctx.accounts.clone.onusd_mint = *ctx.accounts.onusd_mint.to_account_info().key;
    ctx.accounts.clone.admin = *ctx.accounts.admin.to_account_info().key;
    ctx.accounts.clone.bump = *ctx.bumps.get("clone").unwrap();
    ctx.accounts.clone.treasury_address = treasury_address;

    ctx.accounts.clone.liquidator_fee_bps = liquidator_fee_bps;

    // add onusd as first collateral type
    token_data.append_collateral(Collateral {
        oracle_info_index: u64::MAX,
        mint: *ctx.accounts.onusd_mint.to_account_info().key,
        vault: *ctx.accounts.onusd_vault.to_account_info().key,
        vault_borrow_supply: 0,
        vault_comet_supply: 0,
        collateralization_ratio: 100,
        status: 0,
        scale: CLONE_TOKEN_SCALE.into(),
    });
    // add usdc as second collateral type
    let usdc_scale = ctx.accounts.usdc_mint.decimals;
    token_data.append_collateral(Collateral {
        oracle_info_index: u64::MAX,
        mint: *ctx.accounts.usdc_mint.to_account_info().key,
        vault: *ctx.accounts.usdc_vault.to_account_info().key,
        vault_borrow_supply: 0,
        vault_comet_supply: 0,
        collateralization_ratio: 100,
        status: 0,
        scale: usdc_scale.try_into().unwrap(),
    });

    // set token data
    token_data.clone = *ctx.accounts.clone.to_account_info().key;

    Ok(())
}
