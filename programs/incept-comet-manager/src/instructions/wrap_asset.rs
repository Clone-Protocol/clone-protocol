use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::WrapAsset as WrapAssetIncept;
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{Incept, TokenData};

#[derive(Accounts)]
#[instruction(amount: u64, pool_index: u8)]
pub struct WrapAsset<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.incept
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = manager_info
    )]
    pub manager_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].underlying_asset_token_account,
    )]
    pub underlying_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = underlying_asset_token_account.mint,
    )]
    pub asset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = manager_info
    )]
    pub manager_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.incept_program
    )]
    pub incept_program: Program<'info, InceptProgram>,
    #[account(
        mut,
        address = incept.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<WrapAsset>, amount: u64, pool_index: u8) -> Result<()> {
    match ctx.accounts.manager_info.status {
        CometManagerStatus::Open => return_error_if_false!(
            ctx.accounts.signer.key() == ctx.accounts.manager_info.owner,
            InceptCometManagerError::OpenStatusRequired
        ),
        CometManagerStatus::Closing {
            forcefully_closed, ..
        } => {
            return_error_if_false!(
                forcefully_closed,
                InceptCometManagerError::MustBeForcefullyClosedManagers
            )
        }
    };

    let owner = ctx.accounts.manager_info.owner.key();
    let manager_seeds = &[&[
        b"manager-info",
        owner.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.manager_info.bump),
    ][..]];

    // Add collateral to comet
    incept::cpi::wrap_asset(
        CpiContext::new_with_signer(
            ctx.accounts.incept_program.to_account_info(),
            WrapAssetIncept {
                user: ctx.accounts.manager_info.to_account_info(),
                incept: ctx.accounts.incept.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                underlying_asset_token_account: ctx
                    .accounts
                    .underlying_asset_token_account
                    .to_account_info(),
                user_asset_token_account: ctx
                    .accounts
                    .manager_asset_token_account
                    .to_account_info(),
                user_iasset_token_account: ctx
                    .accounts
                    .manager_iasset_token_account
                    .to_account_info(),
                asset_mint: ctx.accounts.asset_mint.to_account_info(),
                iasset_mint: ctx.accounts.iasset_mint.to_account_info(),
            },
            manager_seeds,
        ),
        amount,
        pool_index,
    )?;

    Ok(())
}
