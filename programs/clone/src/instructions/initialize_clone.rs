use crate::decimal::CLONE_TOKEN_SCALE;
use crate::{error::*, return_error_if_false, states::*};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

pub const CLONE_PROGRAM_SEED: &str = "clone";

#[derive(Accounts)]
#[instruction(
    comet_liquidator_fee_bps: u16,
    borrow_liquidator_fee_bps: u16,
    treasury_address: Pubkey,
)]
pub struct InitializeClone<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        space = 8 + 464,
        bump,
        payer = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mint::decimals = CLONE_TOKEN_SCALE as u8,
        mint::authority = clone,
    )]
    pub onusd_mint: Account<'info, Mint>,
    /// CHECK: This is an admin method so this should be correct
    pub usdc_mint: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializeClone>,
    comet_liquidator_fee_bps: u16,
    borrow_liquidator_fee_bps: u16,
    treasury_address: Pubkey,
) -> Result<()> {
    return_error_if_false!(
        comet_liquidator_fee_bps < 10000 && borrow_liquidator_fee_bps < 10000,
        CloneError::InvalidValueRange
    );

    // set manager data
    ctx.accounts.clone.onusd_mint = *ctx.accounts.onusd_mint.to_account_info().key;
    ctx.accounts.clone.admin = *ctx.accounts.admin.to_account_info().key;
    ctx.accounts.clone.bump = *ctx.bumps.get("clone").unwrap();
    ctx.accounts.clone.treasury_address = treasury_address;
    ctx.accounts.clone.comet_liquidator_fee_bps = comet_liquidator_fee_bps;
    ctx.accounts.clone.borrow_liquidator_fee_bps = borrow_liquidator_fee_bps;

    Ok(())
}
