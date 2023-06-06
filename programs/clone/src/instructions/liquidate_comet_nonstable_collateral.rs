use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(amount: u64, comet_nonstable_collateral_index: u8, comet_stable_collateral_index: u8,)]
pub struct LiquidateCometNonStableCollateral<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone
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
        constraint = comet.load()?.num_collaterals > comet_stable_collateral_index.into() @ CloneError::InvalidInputPositionIndex,
        constraint = comet.load()?.num_collaterals > comet_nonstable_collateral_index.into() @ CloneError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        constraint = token_data.load()?.collaterals[comet.load()?.collaterals[comet_stable_collateral_index as usize].collateral_index as usize].stable == 1 @ CloneError::InvalidAssetStability,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_stable_collateral_index as usize].collateral_index as usize].mint
    )]
    pub stable_collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_stable_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub stable_collateral_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = stable_collateral_mint,
        constraint = liquidator_stable_collateral_token_account.amount >= amount @ CloneError::InvalidTokenAccountBalance
   )]
    pub liquidator_stable_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = token_data.load()?.collaterals[comet.load()?.collaterals[comet_nonstable_collateral_index as usize].collateral_index as usize].stable == 0 @ CloneError::InvalidAssetStability,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_nonstable_collateral_index as usize].collateral_index as usize].mint
    )]
    pub nonstable_collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_nonstable_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub nonstable_collateral_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = nonstable_collateral_mint,
   )]
    pub liquidator_nonstable_collateral_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometNonStableCollateral>,
    amount: u64,
    comet_nonstable_collateral_index: u8,
    comet_stable_collateral_index: u8,
) -> Result<()> {
    let manager_seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let user_seeds = &[&[
        b"user",
        ctx.accounts.user.key.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.user_account.bump),
    ][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_nonstable_collateral = comet.collaterals[comet_nonstable_collateral_index as usize];
    let comet_stable_collateral = comet.collaterals[comet_stable_collateral_index as usize];
    let nonstable_collateral =
        token_data.collaterals[comet_nonstable_collateral.collateral_index as usize];
    let stable_collateral =
        token_data.collaterals[comet_stable_collateral.collateral_index as usize];
    let nonstable_asset_info =
        token_data.pools[nonstable_collateral.pool_index as usize].asset_info;

    let health_score = calculate_health_score(&comet, &token_data, None)?;

    return_error_if_false!(
        !health_score.is_healthy(),
        CloneError::NotSubjectToLiquidation
    );

    let stable_collateral_scale = stable_collateral.vault_comet_supply.to_decimal().scale();
    let nonstable_collateral_scale = nonstable_collateral.vault_comet_supply.to_decimal().scale();

    let mut liquidator_stable_swap_in =
        Decimal::new(amount.try_into().unwrap(), stable_collateral_scale);

    let discount = nonstable_asset_info.liquidation_discount_rate.to_decimal();
    let nonstable_price = nonstable_asset_info.price.to_decimal();
    let discounted_price = (Decimal::one() - discount) * nonstable_price;

    let mut vault_nonstable_swap_out = liquidator_stable_swap_in / discounted_price;

    let total_nonstable_available = comet_nonstable_collateral.collateral_amount.to_decimal();

    if vault_nonstable_swap_out > total_nonstable_available {
        vault_nonstable_swap_out = total_nonstable_available;
        liquidator_stable_swap_in = total_nonstable_available * discounted_price;
    }

    liquidator_stable_swap_in =
        rescale_toward_zero(liquidator_stable_swap_in, stable_collateral_scale);
    vault_nonstable_swap_out =
        rescale_toward_zero(vault_nonstable_swap_out, nonstable_collateral_scale);

    // Transfer stable to vault.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                to: ctx
                    .accounts
                    .stable_collateral_vault
                    .to_account_info()
                    .clone(),
                from: ctx
                    .accounts
                    .liquidator_stable_collateral_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.liquidator.to_account_info().clone(),
            },
            user_seeds,
        ),
        liquidator_stable_swap_in.mantissa().try_into().unwrap(),
    )?;
    // Transfer nonstable to liquidator.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                to: ctx
                    .accounts
                    .liquidator_nonstable_collateral_token_account
                    .to_account_info()
                    .clone(),
                from: ctx
                    .accounts
                    .nonstable_collateral_vault
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            manager_seeds,
        ),
        vault_nonstable_swap_out.mantissa().try_into().unwrap(),
    )?;

    ctx.accounts.nonstable_collateral_vault.reload()?;
    ctx.accounts.stable_collateral_vault.reload()?;

    // Update stable and non stable comet collateral values
    comet.collaterals[comet_nonstable_collateral_index as usize].collateral_amount =
        RawDecimal::from(total_nonstable_available - vault_nonstable_swap_out);
    comet.collaterals[comet_stable_collateral_index as usize].collateral_amount = RawDecimal::from(
        comet_stable_collateral.collateral_amount.to_decimal() + liquidator_stable_swap_in,
    );

    token_data.collaterals[comet_nonstable_collateral.collateral_index as usize]
        .vault_comet_supply = RawDecimal::from(
        token_data.collaterals[comet_nonstable_collateral.collateral_index as usize]
            .vault_comet_supply
            .to_decimal()
            - vault_nonstable_swap_out,
    );
    token_data.collaterals[comet_stable_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::from(
            token_data.collaterals[comet_stable_collateral.collateral_index as usize]
                .vault_comet_supply
                .to_decimal()
                + liquidator_stable_swap_in,
        );

    let health_score = calculate_health_score(&comet, &token_data, None)?;

    return_error_if_false!(
        health_score.score
            <= ctx
                .accounts
                .clone
                .liquidation_config
                .max_health_liquidation
                .to_decimal(),
        CloneError::LiquidationAmountTooLarge
    );

    Ok(())
}
