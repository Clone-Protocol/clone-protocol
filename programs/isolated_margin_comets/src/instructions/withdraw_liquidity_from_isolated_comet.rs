use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::__private::bytemuck;
use anchor_lang::prelude::*;
use clone::cpi::accounts::WithdrawLiquidityFromComet;
use clone::cpi::withdraw_liquidity_from_comet;
use clone::instructions::{CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED};
use clone::{
    program::Clone,
    states::User,
    states::{Clone as CloneAccount, Oracles, Pools},
};

#[derive(Accounts)]
#[instruction(position_index: u8, amount: u64)]
pub struct WithdrawLiquidityFromIsolatedComet<'info> {
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
        seeds = [POOLS_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub pools: Account<'info, Pools>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub oracles: Account<'info, Oracles>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromIsolatedComet>,
    position_index: u8,
    amount: u64,
) -> Result<()> {
    // Check that the either the pool_index matches the single position in the isolated comet or that there is not position yet.
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

    let cpi_accounts = WithdrawLiquidityFromComet {
        user: ctx.accounts.owner_account.to_account_info().clone(),
        user_account: ctx.accounts.user_account.to_account_info().clone(),
        clone: ctx.accounts.clone_account.to_account_info().clone(),
        pools: ctx.accounts.pools.to_account_info().clone(),
        oracles: ctx.accounts.oracles.to_account_info().clone(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.clone_program.to_account_info(),
        cpi_accounts,
        seeds,
    );
    withdraw_liquidity_from_comet(cpi_ctx, 0, amount)
}
