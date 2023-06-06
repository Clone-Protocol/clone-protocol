use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::WithdrawCollateralFromComet as WithdrawCollateralFromCometClone;
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{Comet, Clone, TokenData, User, ONUSD_COLLATERAL_INDEX};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawCollateralFromComet<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.key().as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        address = manager_info.clone
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_clone_user: Box<Account<'info, User>>,
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
        address = manager_info.clone_program
    )]
    pub clone_program: Program<'info, CloneProgram>,
    #[account(
        mut,
        address = manager_clone_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = clone.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[ONUSD_COLLATERAL_INDEX].vault
    )]
    pub clone_onusd_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<WithdrawCollateralFromComet>, amount: u64) -> Result<()> {
    // Calculate onusd value to withdraw according to tokens redeemed.
    if matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open) {
        let signer = ctx.accounts.signer.key();
        return_error_if_false!(
            signer == ctx.accounts.manager_info.owner,
            CloneCometManagerError::OpenStatusRequired
        );
    }

    // Withdraw collateral from comet
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];

    clone::cpi::withdraw_collateral_from_comet(
        CpiContext::new_with_signer(
            ctx.accounts.clone_program.to_account_info(),
            WithdrawCollateralFromCometClone {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.manager_clone_user.to_account_info(),
                clone: ctx.accounts.clone.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
                vault: ctx.accounts.clone_onusd_vault.to_account_info(),
                user_collateral_token_account: ctx
                    .accounts
                    .manager_onusd_token_account
                    .to_account_info(),
            },
            manager_seeds,
        ),
        0,
        amount,
    )?;

    Ok(())
}
