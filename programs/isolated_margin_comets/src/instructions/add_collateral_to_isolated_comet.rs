use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::__private::bytemuck;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::AddCollateralToComet;
use clone::cpi::add_collateral_to_comet;
use clone::instructions::{CLONE_PROGRAM_SEED, USER_SEED};
use clone::{program::Clone, states::Clone as CloneAccount, states::User};

#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct AddCollateralToIsolatedComet<'info> {
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
    pub clone_account: Account<'info, CloneAccount>,
    #[account(
        mut,
        token::mint = clone_account.collateral.mint,
        token::authority = owner_account
    )]
    pub owner_collateral_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = clone_account.collateral.vault)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<AddCollateralToIsolatedComet>, position_index: u8) -> Result<()> {
    let position_manager = &ctx.accounts.manager_account;
    let position_index = position_index as usize;
    let unique_seed = position_manager.account_seeds[position_index];

    let cpi_accounts = AddCollateralToComet {
        user: ctx.accounts.owner_account.to_account_info().clone(),
        user_account: ctx.accounts.user_account.to_account_info().clone(),
        clone: ctx.accounts.clone_account.to_account_info().clone(),
        vault: ctx.accounts.vault.to_account_info().clone(),
        user_collateral_token_account: ctx
            .accounts
            .owner_collateral_token_account
            .to_account_info()
            .clone(),
        token_program: ctx.accounts.token_program.to_account_info().clone(),
    };

    let manager_pubkey = ctx.accounts.manager_account.key();
    let inner_seed = [unique_seed];
    let seeds = &[&[
        &inner_seed,
        manager_pubkey.as_ref(),
        bytemuck::bytes_of(ctx.bumps.get("owner_account").unwrap()),
    ][..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.clone_program.to_account_info(),
        cpi_accounts,
        seeds,
    );

    let amount = ctx.accounts.owner_collateral_token_account.amount;

    add_collateral_to_comet(cpi_ctx, amount)
}
