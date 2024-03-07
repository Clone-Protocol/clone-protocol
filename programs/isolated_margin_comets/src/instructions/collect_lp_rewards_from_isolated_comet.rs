use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::__private::bytemuck;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::CollectLpRewards;
use clone::cpi::collect_lp_rewards;
use clone::instructions::{CLONE_PROGRAM_SEED, POOLS_SEED, USER_SEED};
use clone::{
    program::Clone,
    states::Clone as CloneAccount,
    states::{Pools, User},
};

#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct CollectLpRewardsFromIsolatedComet<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        seeds = [MANAGER_SEED.as_ref(), signer.key.as_ref()],
        bump,
    )]
    pub manager_account: Account<'info, PositionManager>,
    #[account(
        seeds = [&[manager_account.account_seeds[position_index as usize]], manager_account.to_account_info().key.as_ref()],
        bump,
    )]
    pub owner_account: Account<'info, CometOwner>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), owner_account.to_account_info().key.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub user_account: Account<'info, User>,
    pub clone_program: Program<'info, Clone>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub clone_account: Box<Account<'info, CloneAccount>>,
    #[account(
        seeds = [POOLS_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub pools: Account<'info, Pools>,
    #[account(
        mut,
        address = pools.pools[user_account.comet.positions[0].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = clone_account.collateral.mint,
        token::authority = signer
    )]
    pub signer_collateral_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = onasset_mint,
        token::authority = signer
    )]
    pub signer_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = clone_account.collateral.mint,
        token::authority = owner_account,
    )]
    pub owner_collateral_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = onasset_mint,
        token::authority = owner_account,
    )]
    pub owner_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = clone_account.collateral.vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<CollectLpRewardsFromIsolatedComet>, position_index: u8) -> Result<()> {
    let position_manager = &ctx.accounts.manager_account;
    let position_index = position_index as usize;

    let unique_seed = position_manager.account_seeds[position_index];
    let manager_pubkey = ctx.accounts.manager_account.key();
    let inner_seed = [unique_seed];
    let seeds = &[&[
        &inner_seed,
        manager_pubkey.as_ref(),
        bytemuck::bytes_of(ctx.bumps.get("owner_account").unwrap()),
    ][..]];

    let cpi_accounts = CollectLpRewards {
        user: ctx.accounts.owner_account.to_account_info().clone(),
        user_account: ctx.accounts.user_account.to_account_info().clone(),
        clone: ctx.accounts.clone_account.to_account_info().clone(),
        pools: ctx.accounts.pools.to_account_info().clone(),
        collateral_vault: ctx.accounts.vault.to_account_info().clone(),
        onasset_mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        user_collateral_token_account: ctx
            .accounts
            .owner_collateral_token_account
            .to_account_info()
            .clone(),
        user_onasset_token_account: ctx
            .accounts
            .owner_onasset_token_account
            .to_account_info()
            .clone(),
        token_program: ctx.accounts.token_program.to_account_info().clone(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.clone_program.to_account_info(),
        cpi_accounts,
        seeds,
    );

    collect_lp_rewards(cpi_ctx, 0)?;

    ctx.accounts.owner_collateral_token_account.reload()?;

    if ctx.accounts.owner_collateral_token_account.amount > 0 {
        let amount = ctx.accounts.owner_collateral_token_account.amount;
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .owner_collateral_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .signer_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.owner_account.to_account_info().clone(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            seeds,
        );
        transfer(cpi_ctx, amount)?;
    }

    ctx.accounts.owner_onasset_token_account.reload()?;

    if ctx.accounts.owner_onasset_token_account.amount > 0 {
        let amount = ctx.accounts.owner_onasset_token_account.amount;
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .owner_onasset_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .signer_onasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.owner_account.to_account_info().clone(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            seeds,
        );
        transfer(cpi_ctx, amount)?;
    }

    Ok(())
}
