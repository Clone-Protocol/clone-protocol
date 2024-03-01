use crate::{error::*, return_error_if_false, states::*};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

pub const CLONE_PROGRAM_SEED: &str = "clone";

#[derive(Accounts)]
#[instruction(
    comet_collateral_ild_liquidator_fee_bps: u16,
    comet_onasset_ild_liquidator_fee_bps: u16,
    borrow_liquidator_fee_bps: u16,
    treasury_address: Pubkey,
    collateral_oracle_index: u8,
    collateralization_ratio: u8,
)]
pub struct InitializeClone<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        space = 8 + 472,
        bump,
        payer = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        token::mint = collateral_mint,
        token::authority = clone,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializeClone>,
    comet_collateral_ild_liquidator_fee_bps: u16,
    comet_onasset_ild_liquidator_fee_bps: u16,
    borrow_liquidator_fee_bps: u16,
    treasury_address: Pubkey,
    collateral_oracle_index: u8,
    collateralization_ratio: u8,
) -> Result<()> {
    return_error_if_false!(
        comet_onasset_ild_liquidator_fee_bps < 10000 && borrow_liquidator_fee_bps < 10000,
        CloneError::InvalidValueRange
    );

    // set manager data
    ctx.accounts.clone.admin = *ctx.accounts.admin.to_account_info().key;
    ctx.accounts.clone.bump = ctx.bumps.clone;
    ctx.accounts.clone.treasury_address = treasury_address;
    ctx.accounts.clone.collateral = Collateral {
        vault: ctx.accounts.collateral_vault.to_account_info().key(),
        mint: ctx.accounts.collateral_mint.to_account_info().key(),
        scale: ctx.accounts.collateral_mint.decimals,
        oracle_info_index: collateral_oracle_index,
        collateralization_ratio,
    };
    ctx.accounts.clone.comet_collateral_ild_liquidator_fee_bps =
        comet_collateral_ild_liquidator_fee_bps;
    ctx.accounts.clone.comet_onasset_ild_liquidator_fee_bps = comet_onasset_ild_liquidator_fee_bps;
    ctx.accounts.clone.borrow_liquidator_fee_bps = borrow_liquidator_fee_bps;

    Ok(())
}
