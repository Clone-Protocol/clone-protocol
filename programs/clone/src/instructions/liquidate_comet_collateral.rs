use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(amount: u64, comet_collateral_index: u8)]
pub struct LiquidateCometCollateral<'info> {
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
        constraint = comet.load()?.num_collaterals > comet_collateral_index.into() @ CloneError::InvalidInputPositionIndex,
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = clone.onusd_mint,
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[ONUSD_COLLATERAL_INDEX].vault,
   )]
    pub onusd_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = onusd_mint,
        constraint = liquidator_onusd_token_account.amount >= amount @ CloneError::InvalidTokenAccountBalance
   )]
    pub liquidator_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].mint
    )]
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub collateral_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = collateral_mint,
   )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometCollateral>,
    collateral_amount: u64,
    comet_collateral_index: u8,
) -> Result<()> {
    let manager_seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let user_seeds = &[&[
        b"user",
        ctx.accounts.user.key.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.user_account.bump),
    ][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let onusd_comet_collateral = comet.collaterals[0usize];
    let collateral =
        token_data.collaterals[comet_collateral.collateral_index as usize];
    let oracle = token_data.oracles[collateral.oracle_info_index as usize];

    return_error_if_false!(
        comet_collateral.collateral_index as usize != ONUSD_COLLATERAL_INDEX && comet_collateral.collateral_index as usize != USDC_COLLATERAL_INDEX,
        CloneError::InvalidInputPositionIndex
    );

    let health_score = calculate_health_score(&comet, &token_data)?;

    return_error_if_false!(
        !health_score.is_healthy(),
        CloneError::NotSubjectToLiquidation
    );

    let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();
    let total_collateral_available = comet_collateral.collateral_amount.to_decimal();
    let collateral_swap_out = rescale_toward_zero(Decimal::new(
        collateral_amount.try_into().unwrap(), collateral_scale
    ).min(total_collateral_available), collateral_scale);

    let discount = Decimal::new(5, 2);
    let oracle_price = oracle.price.to_decimal();
    let discounted_price = (Decimal::one() - discount) * oracle_price;

    let onusd_amount_in = rescale_toward_zero(collateral_swap_out * discounted_price, CLONE_TOKEN_SCALE);
    // Transfer onusd to vault.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                to: ctx
                    .accounts
                    .onusd_vault
                    .to_account_info()
                    .clone(),
                from: ctx
                    .accounts
                    .liquidator_onusd_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.liquidator.to_account_info().clone(),
            },
            user_seeds,
        ),
        onusd_amount_in.mantissa().try_into().unwrap(),
    )?;
    // Transfer collateral to liquidator.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                to: ctx
                    .accounts
                    .liquidator_collateral_token_account
                    .to_account_info()
                    .clone(),
                from: ctx
                    .accounts
                    .collateral_vault
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            manager_seeds,
        ),
        collateral_swap_out.mantissa().try_into().unwrap(),
    )?;

    ctx.accounts.onusd_vault.reload()?;
    ctx.accounts.collateral_vault.reload()?;

    // Update stable and non stable comet collateral values
    comet.collaterals[comet_collateral_index as usize].collateral_amount =
        RawDecimal::from(total_collateral_available - collateral_swap_out);
    comet.collaterals[0usize].collateral_amount = RawDecimal::from(
        onusd_comet_collateral.collateral_amount.to_decimal() + onusd_amount_in
    );

    token_data.collaterals[comet_collateral.collateral_index as usize]
        .vault_comet_supply = RawDecimal::from(
        token_data.collaterals[comet_collateral.collateral_index as usize]
            .vault_comet_supply
            .to_decimal()
            - collateral_swap_out,
    );
    token_data.collaterals[ONUSD_COLLATERAL_INDEX].vault_comet_supply =
        RawDecimal::from(
            token_data.collaterals[ONUSD_COLLATERAL_INDEX]
                .vault_comet_supply
                .to_decimal()
                + onusd_amount_in,
        );
    let health_score = calculate_health_score(&comet, &token_data)?;

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
