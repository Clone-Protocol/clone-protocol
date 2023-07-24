use crate::error::CloneError;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(scale: u8, stable: bool, collateralization_ratio: u8, oracle_info_index: u8)]
pub struct AddCollateral<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = collateral_mint,
        token::authority = clone,
        payer = admin
    )]
    pub vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<AddCollateral>,
    scale: u8,
    stable: bool,
    collateralization_ratio: u8,
    oracle_info_index: u8,
    liquidation_discount: u8,
) -> Result<()> {
    return_error_if_false!(
        if !stable {
            collateralization_ratio > 0
        } else {
            true
        },
        CloneError::NonZeroCollateralizationRatioRequired
    );

    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    // append collateral to list
    token_data.append_collateral(Collateral {
        oracle_info_index: oracle_info_index.into(),
        mint: *ctx.accounts.collateral_mint.to_account_info().key,
        vault: *ctx.accounts.vault.to_account_info().key,
        vault_onusd_supply: RawDecimal::new(0, scale.into()),
        vault_mint_supply: RawDecimal::new(0, scale.into()),
        vault_comet_supply: RawDecimal::new(0, scale.into()),
        stable: stable as u64,
        collateralization_ratio: RawDecimal::from_percent(
            collateralization_ratio.try_into().unwrap(),
        ),
        liquidation_discount: RawDecimal::from_percent(liquidation_discount.try_into().unwrap()),
    });

    Ok(())
}
