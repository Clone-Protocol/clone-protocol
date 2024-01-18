use crate::{error::*, return_error_if_false, states::*};
use crate::{CLONE_PROGRAM_SEED, POOLS_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(
    pool_index: u8,
)]
pub struct RemovePool<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = (pool_index as usize) < pools.pools.len() @ CloneError::PoolNotFound,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        address = underlying_asset_token_account.mint
    )]
    pub underlying_asset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = pools.pools[pool_index as usize].underlying_asset_token_account,
    )]
    pub underlying_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = underlying_asset_mint,
        associated_token::authority = clone.treasury_address,
    )]
    pub treasury_asset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<RemovePool>, pool_index: u8) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];

    let pools = &mut ctx.accounts.pools;
    let pool = &pools.pools[pool_index as usize];

    return_error_if_false!(
        pool.status == Status::Deprecation,
        CloneError::StatusPreventsAction
    );

    let balance = ctx.accounts.underlying_asset_token_account.amount;

    if balance > 0 {
        // transfer underlying asset to treasury
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .underlying_asset_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .treasury_asset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            ),
            balance,
        )?;
    }

    pools.pools.remove(pool_index as usize);

    Ok(())
}
