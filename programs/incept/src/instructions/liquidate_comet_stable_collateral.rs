use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_collateral_index: u8)]
pub struct LiquidateCometStableCollateral<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    /// CHECK: Only used for address validation.
    #[account(
        address = user_account.authority
    )]
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
        has_one = comet,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        address = user_account.comet,
        constraint = comet.load()?.is_single_pool == 0,
        constraint = comet.load()?.owner == user_account.authority @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_collaterals > comet_collateral_index.into() @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault,
   )]
    pub usdi_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometStableCollateral>,
    comet_collateral_index: u8,
) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    return_error_if_false!(
        comet_collateral.collateral_index as usize != USDI_COLLATERAL_INDEX
            && collateral.stable == 1,
        InceptError::InvalidCollateralType
    );

    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, &token_data, None)?;

    return_error_if_false!(
        !health_score.is_healthy(),
        InceptError::NotSubjectToLiquidation
    );

    let mut collateral_to_convert = comet_collateral.collateral_amount.to_decimal();
    // Update collaterals. // Need to check the rescaling.
    comet.collaterals[comet_collateral_index as usize].collateral_amount =
        RawDecimal::from(Decimal::new(0, collateral_to_convert.scale()));
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::from(
            token_data.collaterals[comet_collateral.collateral_index as usize]
                .vault_comet_supply
                .to_decimal()
                - collateral_to_convert,
        );
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
        RawDecimal::from(
            token_data.collaterals[comet_collateral.collateral_index as usize]
                .vault_usdi_supply
                .to_decimal()
                + collateral_to_convert,
        );

    collateral_to_convert = rescale_toward_zero(collateral_to_convert, DEVNET_TOKEN_SCALE);
    // USDi is at 0 index
    comet.collaterals[0usize].collateral_amount = RawDecimal::from(
        comet.collaterals[0usize].collateral_amount.to_decimal() + collateral_to_convert,
    );
    token_data.collaterals[USDI_COLLATERAL_INDEX].vault_comet_supply = RawDecimal::from(
        token_data.collaterals[USDI_COLLATERAL_INDEX]
            .vault_comet_supply
            .to_decimal()
            + collateral_to_convert,
    );

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            MintTo {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx.accounts.usdi_vault.to_account_info().clone(),
                authority: ctx.accounts.incept.to_account_info().clone(),
            },
            seeds,
        ),
        collateral_to_convert.mantissa().try_into().unwrap(),
    )?;

    Ok(())
}
