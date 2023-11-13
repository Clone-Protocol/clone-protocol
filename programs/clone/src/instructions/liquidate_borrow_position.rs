use crate::decimal::rescale_toward_zero;
use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::to_ratio_decimal;
use crate::{
    to_bps_decimal, to_clone_decimal, CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, borrow_index: u8, amount: u64)]
pub struct LiquidateBorrowPosition<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        address = pools.pools[user_account.borrows[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = clone.collateral.vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = liquidator
   )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateBorrowPosition>,
    user: Pubkey,
    borrow_index: u8,
    amount: u64,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];

    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;

    let borrows = &mut ctx.accounts.user_account.borrows;
    let borrow_position = borrows[borrow_index as usize];
    let pool_index = borrow_position.pool_index as usize;
    let pool = &pools.pools[pool_index];
    return_error_if_false!(
        pool.status != Status::Frozen,
        CloneError::StatusPreventsAction
    );

    let pool_oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_oracle = &oracles.oracles[collateral.oracle_info_index as usize];

    let min_overcollateral_ratio = to_ratio_decimal!(pool.asset_info.min_overcollateral_ratio);
    let collateralization_ratio = to_ratio_decimal!(collateral.collateralization_ratio);

    let burn_amount = amount.min(borrow_position.borrowed_onasset);
    let collateral_position_amount =
        collateral.to_collateral_decimal(borrow_position.collateral_amount)?;

    // This call checks that the oracles are updated
    let is_undercollateralized = check_mint_collateral_sufficient(
        pool_oracle,
        collateral_oracle,
        to_clone_decimal!(borrow_position.borrowed_onasset),
        min_overcollateral_ratio,
        collateralization_ratio,
        collateral_position_amount,
    )
    .is_err();
    let is_in_liquidation_mode = pool.status == Status::Liquidation;

    return_error_if_false!(
        is_undercollateralized || is_in_liquidation_mode,
        CloneError::BorrowPositionUnableToLiquidate
    );

    let borrow_liquidation_fee_rate = to_bps_decimal!(ctx.accounts.clone.borrow_liquidator_fee_bps);
    let pool_price = pool_oracle
        .get_price()?
        .checked_div(collateral_oracle.get_price()?)
        .ok_or(error!(CloneError::CheckedMathError))?;

    let collateral_reward = rescale_toward_zero(
        (Decimal::one()
            .checked_add(borrow_liquidation_fee_rate)
            .ok_or(error!(CloneError::CheckedMathError))?)
        .checked_mul(to_clone_decimal!(burn_amount))
        .ok_or(error!(CloneError::CheckedMathError))?
        .checked_mul(pool_price)
        .ok_or(error!(CloneError::CheckedMathError))?,
        collateral
            .scale
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
    )
    .min(collateral_position_amount);

    // Burn the onAsset from the liquidator
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .liquidator_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.liquidator.to_account_info().clone(),
    };
    let burn_liquidator_onasset_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::burn(burn_liquidator_onasset_context, burn_amount)?;

    // Send the user the collateral reward
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .liquidator_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let send_collateral_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    token::transfer(
        send_collateral_context,
        collateral_reward
            .mantissa()
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
    )?;

    // Update data
    borrows[borrow_index as usize].borrowed_onasset = borrows[borrow_index as usize]
        .borrowed_onasset
        .checked_sub(burn_amount)
        .ok_or(error!(CloneError::CheckedMathError))?;
    borrows[borrow_index as usize].collateral_amount = borrows[borrow_index as usize]
        .collateral_amount
        .checked_sub(
            collateral_reward
                .mantissa()
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?,
        )
        .ok_or(error!(CloneError::CheckedMathError))?;

    // Remove position if empty
    if borrows[borrow_index as usize].is_empty() {
        borrows.remove(borrow_index as usize);
    } else {
        let borrowed_onasset = to_clone_decimal!(borrows[borrow_index as usize].borrowed_onasset);
        let collateral_amount = Decimal::new(
            borrows[borrow_index as usize]
                .collateral_amount
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?,
            collateral
                .scale
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?,
        );
        let max_liquidation_overcollateral_ratio =
            to_ratio_decimal!(pool.asset_info.max_liquidation_overcollateral_ratio);
        let c_ratio = collateral_amount
            .checked_mul(collateralization_ratio)
            .ok_or(error!(CloneError::CheckedMathError))?
            .checked_div(
                pool_price
                    .checked_mul(borrowed_onasset)
                    .ok_or(error!(CloneError::CheckedMathError))?,
            )
            .ok_or(error!(CloneError::CheckedMathError))?;
        return_error_if_false!(
            c_ratio <= max_liquidation_overcollateral_ratio,
            CloneError::InvalidMintCollateralRatio
        );
    }

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: user,
        pool_index: pool_index
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?,
        is_liquidation: true,
        collateral_supplied: borrows[borrow_index as usize].collateral_amount,
        collateral_delta: -(collateral_reward
            .mantissa()
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?),
        borrowed_amount: borrows[borrow_index as usize].borrowed_onasset,
        borrowed_delta: -(burn_amount
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?)
    });
    ctx.accounts.clone.event_counter = ctx
        .accounts
        .clone
        .event_counter
        .checked_add(1)
        .ok_or(error!(CloneError::CheckedMathError))?;

    Ok(())
}
