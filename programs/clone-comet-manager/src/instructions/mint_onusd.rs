use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::MintONUSD as MintONUSDClone;
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{Clone, TokenData, USDC_COLLATERAL_INDEX};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MintONUSD<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.clone
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_info
    )]
    pub manager_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].mint,
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdc_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.clone_program
    )]
    pub clone_program: Program<'info, CloneProgram>,
    #[account(
        mut,
        address = clone.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].vault
    )]
    pub clone_usdc_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<MintONUSD>, amount: u64) -> Result<()> {
    // Calculate membership amount to mint
    match ctx.accounts.manager_info.status {
        CometManagerStatus::Open => return_error_if_false!(
            ctx.accounts.signer.key() == ctx.accounts.manager_info.owner,
            CloneCometManagerError::OpenStatusRequired
        ),
        CometManagerStatus::Closing {
            forcefully_closed, ..
        } => {
            return_error_if_false!(
                forcefully_closed,
                CloneCometManagerError::MustBeForcefullyClosedManagers
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
    clone::cpi::mint_onusd(
        CpiContext::new_with_signer(
            ctx.accounts.clone_program.to_account_info(),
            MintONUSDClone {
                user: ctx.accounts.manager_info.to_account_info(),
                clone: ctx.accounts.clone.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                user_onusd_token_account: ctx.accounts.manager_onusd_token_account.to_account_info(),
                user_collateral_token_account: ctx
                    .accounts
                    .manager_usdc_token_account
                    .to_account_info(),
                onusd_mint: ctx.accounts.onusd_mint.to_account_info(),
                usdc_vault: ctx.accounts.clone_usdc_vault.to_account_info(),
            },
            manager_seeds,
        ),
        amount,
    )?;

    Ok(())
}
