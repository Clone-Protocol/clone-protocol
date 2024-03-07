use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::__private::bytemuck;
use anchor_lang::prelude::*;
use clone::cpi::accounts::CloseUserAccount;
use clone::cpi::close_user_account;
use clone::instructions::USER_SEED;
use clone::{program::Clone, states::User};

#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct CloseIsolatedComet<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [MANAGER_SEED.as_ref(), signer.key.as_ref()],
        bump,
    )]
    pub manager_account: Account<'info, PositionManager>,
    #[account(
        mut,
        seeds = [&[manager_account.account_seeds[position_index as usize]], manager_account.to_account_info().key.as_ref()],
        bump,
        close = signer,
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
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseIsolatedComet>, position_index: u8) -> Result<()> {
    // Need to check that seed is in Vec<PositionManager>
    let position_manager = &mut ctx.accounts.manager_account;
    let position_index = position_index as usize;

    let unique_seed = position_manager.account_seeds[position_index];
    position_manager.account_seeds.remove(position_index);

    // Perform a CPI call into clone to close user account.
    let cpi_accounts = CloseUserAccount {
        user: ctx.accounts.owner_account.to_account_info().clone(),
        user_account: ctx.accounts.user_account.to_account_info().clone(),
        destination: ctx.accounts.signer.to_account_info().clone(),
        system_program: ctx.accounts.system_program.to_account_info().clone(),
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
    close_user_account(cpi_ctx)
}
