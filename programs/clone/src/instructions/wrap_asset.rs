use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(amount: u64, pool_index: u8)]
pub struct WrapAsset<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].underlying_asset_token_account,
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
        address = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
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

pub fn execute(ctx: Context<WrapAsset>, amount: u64, pool_index: u8) -> Result<()> {
    let token_data = ctx.accounts.token_data.load()?;
    return_error_if_false!(
        (pool_index as u64) < token_data.num_pools,
        CloneError::PoolNotFound
    );

    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];

    // transfer user collateral to vault
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_asset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .underlying_asset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        ),
        amount,
    )?;

    // mint onasset to user
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
        amount,
    )?;

    Ok(())
}