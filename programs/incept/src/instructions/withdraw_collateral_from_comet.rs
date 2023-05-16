use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_collateral_index: u8, collateral_amount: u64)]
pub struct WithdrawCollateralFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (comet_collateral_index as u64) < comet.load()?.num_collaterals @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawCollateralFromComet>,
    comet_collateral_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let comet_collateral_index = comet_collateral_index as usize;

    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_collateral = comet.collaterals[comet_collateral_index];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();

    let subtracted_collateral_value = rescale_toward_zero(
        Decimal::new(collateral_amount.try_into().unwrap(), collateral_scale)
            .min(comet_collateral.collateral_amount.to_decimal()),
        collateral_scale,
    );
    // subtract collateral amount from vault supply
    let vault_comet_supply = rescale_toward_zero(
        collateral.vault_comet_supply.to_decimal() - subtracted_collateral_value,
        collateral_scale,
    );
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::from(vault_comet_supply);

    // update the collateral amount
    let new_collateral_amount = rescale_toward_zero(
        comet_collateral.collateral_amount.to_decimal() - subtracted_collateral_value,
        collateral_scale,
    );

    comet.collaterals[comet_collateral_index].collateral_amount =
        RawDecimal::from(new_collateral_amount);

    // remove collateral if empty and not the last USDI collateral.
    if new_collateral_amount.is_zero() && comet_collateral_index != USDI_COLLATERAL_INDEX {
        comet.remove_collateral(comet_collateral_index);
    }

    // send collateral from vault to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        subtracted_collateral_value.mantissa().try_into().unwrap(),
    )?;
    let health_score = calculate_health_score(&comet, token_data, None)?;

    return_error_if_false!(health_score.is_healthy(), InceptError::HealthScoreTooLow);

    Ok(())
}
