use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(position_index: u8, collateral_amount: u64)]
pub struct WithdrawCollateralFromSinglePoolComet<'info> {
    #[account(address = comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.single_pool_comets,
        constraint = comet.load()?.is_single_pool == 1,
        constraint = (position_index as u64) < comet.load()?.num_collaterals @ CloneError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[position_index as usize].collateral_index as usize].vault,
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
    ctx: Context<WithdrawCollateralFromSinglePoolComet>,
    position_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let mut comet = ctx.accounts.comet.load_mut()?;
    let index = position_index as usize;
    let comet_position = comet.positions[index];
    let comet_collateral = comet.collaterals[index];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];
    let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();

    let subtracted_collateral_value =
        Decimal::new(collateral_amount.try_into().unwrap(), collateral_scale)
            .min(comet_collateral.collateral_amount.to_decimal());

    // subtract collateral amount from vault supply
    let new_vault_comet_supply = rescale_toward_zero(
        collateral.vault_comet_supply.to_decimal() - subtracted_collateral_value,
        collateral_scale,
    );
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::from(new_vault_comet_supply);

    // update the collateral amount
    let new_collateral_amount = rescale_toward_zero(
        comet_collateral.collateral_amount.to_decimal() - subtracted_collateral_value,
        collateral_scale,
    );
    comet.collaterals[index].collateral_amount = RawDecimal::from(new_collateral_amount);

    if !comet_position.is_empty() {
        let health_score =
            calculate_health_score(&comet, token_data, Some(position_index as usize))?;

        return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);
    }

    // send collateral from vault to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        collateral_amount,
    )?;

    Ok(())
}