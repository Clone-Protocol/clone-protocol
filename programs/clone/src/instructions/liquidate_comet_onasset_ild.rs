use crate::decimal::rescale_toward_zero;
use crate::error::*;
use crate::instructions::withdraw_liquidity;
use crate::math::*;
use crate::states::*;
use crate::{
    return_error_if_false, to_bps_decimal, to_clone_decimal, CLONE_PROGRAM_SEED, ORACLES_SEED,
    POOLS_SEED, USER_SEED,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, comet_position_index: u8, amount: u64)]
pub struct LiquidateCometOnassetIld<'info> {
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
        address = pools.pools[user_account.comet.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = onasset_mint,
    )]
    pub liquidator_onasset_token_account: Box<Account<'info, TokenAccount>>,
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
    ctx: Context<LiquidateCometOnassetIld>,
    user: Pubkey,
    comet_position_index: u8,
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
    let comet = &mut ctx.accounts.user_account.comet;
    let comet_position = comet.positions[comet_position_index as usize];
    let authorized_amount = to_clone_decimal!(amount);
    let ild_share = calculate_ild_share(&comet_position, pools, collateral)?;
    let pool_index = comet_position.pool_index as usize;
    let pool = &pools.pools[pool_index];

    return_error_if_false!(
        pool.status == Status::Active || pool.status == Status::Liquidation,
        CloneError::StatusPreventsAction
    );

    let pool_oracle = &oracles.oracles[pool.asset_info.oracle_info_index as usize];
    let onasset_price = pool_oracle.get_price();
    let collateral_oracle = &oracles.oracles[collateral.oracle_info_index as usize];
    let collateral_price = collateral_oracle.get_price();
    let collateral_scale = collateral.scale as u32;
    let pool_price = onasset_price / collateral_price;

    let is_in_liquidation_mode = pool.status == Status::Liquidation;
    let starting_health_score = calculate_health_score(comet, pools, oracles, collateral)?;

    return_error_if_false!(
        !starting_health_score.is_healthy() || is_in_liquidation_mode,
        CloneError::NotSubjectToLiquidation
    );

    let burn_amount = ild_share.onasset_ild_share.min(authorized_amount);

    let liquidator_fee = to_bps_decimal!(ctx.accounts.clone.comet_onasset_ild_liquidator_fee_bps);

    // calculate reward for liquidator
    let collateral_reward = rescale_toward_zero(
        (Decimal::one() + liquidator_fee) * pool_price * burn_amount,
        collateral_scale,
    );

    if ild_share.onasset_ild_share > Decimal::ZERO {
        let ild_rebate_increase: i64 = burn_amount
            .mantissa()
            .try_into()
            .map_err(|_| CloneError::IntTypeConversionError)?;
        comet.positions[comet_position_index as usize].onasset_ild_rebate += ild_rebate_increase;
        let cpi_accounts = Burn {
            mint: ctx.accounts.onasset_mint.to_account_info().clone(),
            from: ctx
                .accounts
                .liquidator_onasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.liquidator.to_account_info().clone(),
        };

        token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            ild_rebate_increase
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?,
        )?;

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
            collateral_reward
                .mantissa()
                .try_into()
                .map_err(|_| CloneError::IntTypeConversionError)?,
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
            collateral,
            comet_position_index,
            comet_position.committed_collateral_liquidity,
            user,
            ctx.accounts.clone.event_counter,
        )?;
    };
    ctx.accounts.clone.event_counter += 1;

    if comet.positions[comet_position_index as usize].is_empty() {
        comet.positions.remove(comet_position_index as usize);
    }

    Ok(())
}
