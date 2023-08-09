use crate::decimal::rescale_toward_zero;
use crate::error::*;
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
#[instruction(comet_position_index: u8)]
pub struct LiquidateCometCollateralIld<'info> {
    pub liquidator: Signer<'info>,
    /// CHECK: Only used for address validation.
    pub user: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = user_account.comet.positions.len() > comet_position_index.into() @ CloneError::InvalidInputPositionIndex,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = pools.pools[user_account.comet.positions[comet_position_index as usize].pool_index as usize].status == Status::Active ||
        pools.pools[user_account.comet.positions[comet_position_index as usize].pool_index as usize].status == Status::Liquidation @ CloneError::StatusPreventsAction
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

pub fn execute(ctx: Context<LiquidateCometCollateralIld>, comet_position_index: u8) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;
    let comet = &mut ctx.accounts.user_account.comet;

    let comet_position = comet.positions[comet_position_index as usize];
    let ild_share = calculate_ild_share(&comet_position, pools);
    let pool_index = comet_position.pool_index as usize;
    let pool = &pools.pools[pool_index];
    let collateral_scale = collateral.scale as u32;

    let is_in_liquidation_mode = pool.status == Status::Liquidation;
    let starting_health_score = calculate_health_score(comet, pools, oracles, collateral)?;

    return_error_if_false!(
        !starting_health_score.is_healthy() || is_in_liquidation_mode,
        CloneError::NotSubjectToLiquidation
    );

    let liquidator_fee =
        to_bps_decimal!(ctx.accounts.clone.comet_collateral_ild_liquidator_fee_bps);

    // calculate reward for liquidator
    let collateral_reward = rescale_toward_zero(
        (Decimal::one() + liquidator_fee) * ild_share.collateral_ild_share,
        collateral_scale,
    );

    if ild_share.collateral_ild_share > Decimal::ZERO {
        comet.positions[comet_position_index as usize].collateral_ild_rebate = 0;

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
            collateral_reward.mantissa().try_into().unwrap(),
        )?;

        // Remove equivalent reward from user's collateral
        comet.collateral_amount -= collateral_reward.mantissa() as u64;
    }

    // Withdraw liquidity position
    if comet_position.committed_collateral_liquidity > 0 {
        withdraw_liquidity(
            pools,
            oracles,
            comet,
            comet_position_index,
            comet_position.committed_collateral_liquidity,
            ctx.accounts.user.key(),
            ctx.accounts.clone.event_counter,
        )?;
    };
    ctx.accounts.clone.event_counter += 1;

    if comet.positions[comet_position_index as usize].is_empty() {
        comet.positions.remove(comet_position_index as usize);
    }

    Ok(())
}
