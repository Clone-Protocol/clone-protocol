use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::__private::bytemuck;
use anchor_lang::prelude::*;
use clone::cpi::accounts::RemoveCometPosition;
use clone::cpi::remove_comet_position;
use clone::instructions::{POOLS_SEED, USER_SEED};
use clone::{
    program::Clone,
    states::{Pools, User},
};

#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct RemovePositionFromIsolatedComet<'info> {
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
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub pools: Account<'info, Pools>,
    pub clone_program: Program<'info, Clone>,
}

pub fn execute(ctx: Context<RemovePositionFromIsolatedComet>, position_index: u8) -> Result<()> {
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

    remove_comet_position(
        CpiContext::new_with_signer(
            ctx.accounts.clone_program.to_account_info(),
            RemoveCometPosition {
                user: ctx.accounts.owner_account.to_account_info().clone(),
                user_account: ctx.accounts.user_account.to_account_info().clone(),
                pools: ctx.accounts.pools.to_account_info().clone(),
            },
            seeds,
        ),
        0,
    )
}
