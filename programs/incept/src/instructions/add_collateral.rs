use crate::error::InceptError;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(scale: u8, stable: bool, collateralization_ratio: u64, pool_index: u8)]
pub struct AddCollateral<'info> {
    #[account(mut, address = incept.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = collateral_mint,
        token::authority = incept,
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
    collateralization_ratio: u64,
    pool_index: u8,
) -> Result<()> {
    return_error_if_false!(
        if !stable {
            collateralization_ratio > 0
        } else {
            true
        },
        InceptError::NonZeroCollateralizationRatioRequired
    );

    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    // append collateral to list
    token_data.append_collateral(Collateral {
        pool_index: if stable {
            u8::MAX.try_into().unwrap()
        } else {
            pool_index.try_into().unwrap()
        },
        mint: *ctx.accounts.collateral_mint.to_account_info().key,
        vault: *ctx.accounts.vault.to_account_info().key,
        vault_usdi_supply: RawDecimal::new(0, scale.into()),
        vault_mint_supply: RawDecimal::new(0, scale.into()),
        vault_comet_supply: RawDecimal::new(0, scale.into()),
        stable: stable as u64,
        collateralization_ratio: RawDecimal::new(
            collateralization_ratio.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        ),
    });

    Ok(())
}
