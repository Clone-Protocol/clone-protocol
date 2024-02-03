use crate::decimal::rescale_toward_zero;
use crate::error::*;
use crate::events::*;
use crate::instructions::withdraw_liquidity;
use crate::math::*;
use crate::states::*;
use crate::{
    return_error_if_false, to_bps_decimal, CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, comet_position_index: u8)]
pub struct LiquidateCometCollateralIld<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
    #[account(
        mut,
        address = clone.collateral.mint
    )]
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = vault.mint,
    )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = clone.collateral.vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometCollateralIld>,
    user: Pubkey,
    comet_position_index: u8,
) -> Result<()> {
    if !ctx.accounts.clone.non_auth_liquidations_enabled {
        return_error_if_false!(
            ctx.accounts
                .clone
                .auth
                .contains(ctx.accounts.liquidator.key),
            CloneError::Unauthorized
        );
    }

    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;
    let comet = &mut ctx.accounts.user_account.comet;

    let comet_position = comet.positions[comet_position_index as usize];
    let ild_share = calculate_ild_share(&comet_position, pools, collateral)?;
    let pool_index = comet_position.pool_index as usize;
    let pool = &pools.pools[pool_index];
    return_error_if_false!(
        pool.status == Status::Active || pool.status == Status::Liquidation,
        CloneError::StatusPreventsAction
    );
    let collateral_scale = collateral
        .scale
        .try_into()
        .map_err(|_| CloneError::IntTypeConversionError)?;

    let is_in_liquidation_mode = pool.status == Status::Liquidation;
    let starting_health_score = calculate_health_score(comet, pools, oracles, collateral)?;

    return_error_if_false!(
        !starting_health_score.is_healthy() || is_in_liquidation_mode,
        CloneError::NotSubjectToLiquidation
    );

    if ild_share.collateral_ild_share > Decimal::ZERO {
        // calculate reward for liquidator
        let liquidator_fee =
            to_bps_decimal!(ctx.accounts.clone.comet_collateral_ild_liquidator_fee_bps);
        let collateral_reward: u64 = rescale_toward_zero(
            liquidator_fee
                .checked_mul(ild_share.collateral_ild_share)
                .ok_or(error!(CloneError::CheckedMathError))?,
            collateral_scale,
        )
        .mantissa()
        .try_into()
        .map_err(|_| CloneError::IntTypeConversionError)?;
        // Remove equivalent reward from user's collateral
        let ild_share: u64 = ild_share
            .collateral_ild_share
            .mantissa()
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?;
        let collateral_reduction = collateral_reward
            .checked_add(ild_share)
            .ok_or(error!(CloneError::CheckedMathError))?;
        return_error_if_false!(
            collateral_reduction <= comet.collateral_amount,
            CloneError::InvalidTokenAmount
        );
        comet.collateral_amount = comet
            .collateral_amount
            .checked_sub(collateral_reduction)
            .ok_or(error!(CloneError::CheckedMathError))?;
        comet.positions[comet_position_index as usize].collateral_ild_rebate = comet.positions
            [comet_position_index as usize]
            .collateral_ild_rebate
            .checked_add(
                ild_share
                    .try_into()
                    .map_err(|_| CloneError::IntTypeConversionError)?,
            )
            .ok_or(error!(CloneError::CheckedMathError))?;

        // Transfer collateral to liquidator
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info().clone(),
            to: ctx
                .accounts
                .liquidator_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
            collateral_reward,
        )?;

        emit!(CometCollateralUpdate {
            event_id: ctx.accounts.clone.event_counter,
            user_address: user.key(),
            collateral_supplied: comet.collateral_amount,
            collateral_delta: -(collateral_reduction
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?),
        });
    }

    // Withdraw liquidity position
    if comet_position.committed_collateral_liquidity > 0 {
        withdraw_liquidity(
            pools,
            oracles,
            comet,
            collateral,
            comet_position_index,
            comet_position.committed_collateral_liquidity,
            user,
            ctx.accounts.clone.event_counter,
        )?;
    };
    ctx.accounts.clone.event_counter = ctx
        .accounts
        .clone
        .event_counter
        .checked_add(1)
        .ok_or(error!(CloneError::CheckedMathError))?;

    if comet.positions[comet_position_index as usize].is_empty() {
        comet.positions.remove(comet_position_index as usize);
    }

    Ok(())
}
