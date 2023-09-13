use crate::error::*;
use crate::math::*;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct CollectLpRewards<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = user_account.comet.positions.len() > comet_position_index.into() @ CloneError::InvalidInputPositionIndex
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
        constraint = pools.pools[user_account.comet.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen @ CloneError::StatusPreventsAction
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        address = clone.collateral.vault
    )]
    pub collateral_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = pools.pools[user_account.comet.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = clone.collateral.mint,
    )]
    pub user_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = onasset_mint,
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<CollectLpRewards>, comet_position_index: u8) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let pools = &ctx.accounts.pools;
    let comet = &mut ctx.accounts.user_account.comet;

    let comet_position = comet.positions[comet_position_index as usize];

    let ild_share = calculate_ild_share(&comet_position, pools, &ctx.accounts.clone.collateral);

    if ild_share.collateral_ild_share < Decimal::ZERO {
        let collateral_reward = ild_share.collateral_ild_share.abs().mantissa() as i64;

        // Update rebate amount such that the ild_share is now zero.
        comet.positions[comet_position_index as usize].collateral_ild_rebate = comet.positions
            [comet_position_index as usize]
            .collateral_ild_rebate
            .checked_sub(collateral_reward)
            .unwrap();

        // Mint reward amount to user
        let cpi_accounts = Transfer {
            from: ctx.accounts.collateral_vault.to_account_info().clone(),
            to: ctx
                .accounts
                .user_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                seeds,
            ),
            collateral_reward.try_into().unwrap(),
        )?;
    }

    if ild_share.onasset_ild_share < Decimal::ZERO {
        let onasset_reward = ild_share.onasset_ild_share.abs().mantissa() as i64;

        // Update rebate amount such that the ild_share is now zero.
        comet.positions[comet_position_index as usize].onasset_ild_rebate = comet.positions
            [comet_position_index as usize]
            .onasset_ild_rebate
            .checked_sub(onasset_reward)
            .unwrap();

        // Mint reward amount to user
        let cpi_accounts = MintTo {
            mint: ctx.accounts.onasset_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .user_onasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                seeds,
            ),
            onasset_reward.try_into().unwrap(),
        )?;
    }

    Ok(())
}
