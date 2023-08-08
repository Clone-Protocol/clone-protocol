use crate::decimal::rescale_toward_zero;
use crate::error::*;
use crate::states::*;
use crate::to_clone_decimal;
use crate::{CLONE_PROGRAM_SEED, POOLS_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(amount: u64, pool_index: u8)]
pub struct UnwrapOnAsset<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = (pool_index as usize) < pools.pools.len() @ CloneError::PoolNotFound,
        constraint = pools.pools[pool_index as usize].status == Status::Active ||
        pools.pools[pool_index as usize].status == Status::Deprecation @ CloneError::StatusPreventsAction,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        address = pools.pools[pool_index as usize].underlying_asset_token_account,
    )]
    pub underlying_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = underlying_asset_token_account.mint
    )]
    pub asset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = user
    )]
    pub user_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = pools.pools[pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<UnwrapOnAsset>, amount: u64, _pool_index: u8) -> Result<()> {
    let underlying_mint_scale = ctx.accounts.asset_mint.decimals as u32;
    let unwrapped_amount =
        rescale_toward_zero(to_clone_decimal!(amount), underlying_mint_scale).mantissa() as u64;

    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];

    // burn onasset from user
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    token::burn(CpiContext::new(cpi_program.clone(), cpi_accounts), amount)?;

    // transfer underlying asset to user
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .underlying_asset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_asset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        unwrapped_amount,
    )?;

    Ok(())
}
