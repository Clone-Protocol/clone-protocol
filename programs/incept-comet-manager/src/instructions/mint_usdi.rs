use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::MintUSDI as MintUSDIIncept;
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{Incept, TokenData, USDC_COLLATERAL_INDEX};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MintUSDI<'info> {
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
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdi_token_account: Box<Account<'info, TokenAccount>>,
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
        address = manager_info.incept_program
    )]
    pub incept_program: Program<'info, InceptProgram>,
    #[account(
        mut,
        address = incept.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].vault
    )]
    pub incept_usdc_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<MintUSDI>, amount: u64) -> Result<()> {
    // Calculate membership amount to mint
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
    incept::cpi::mint_usdi(
        CpiContext::new_with_signer(
            ctx.accounts.incept_program.to_account_info(),
            MintUSDIIncept {
                user: ctx.accounts.manager_info.to_account_info(),
                incept: ctx.accounts.incept.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                user_usdi_token_account: ctx.accounts.manager_usdi_token_account.to_account_info(),
                user_collateral_token_account: ctx
                    .accounts
                    .manager_usdc_token_account
                    .to_account_info(),
                usdi_mint: ctx.accounts.usdi_mint.to_account_info(),
                usdc_vault: ctx.accounts.incept_usdc_vault.to_account_info(),
            },
            manager_seeds,
        ),
        amount,
    )?;

    Ok(())
}
