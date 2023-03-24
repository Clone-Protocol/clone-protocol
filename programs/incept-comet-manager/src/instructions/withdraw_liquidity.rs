use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::WithdrawLiquidityFromComet;
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{Comet, Incept, TokenData, User, USDI_COLLATERAL_INDEX};

#[derive(Accounts)]
#[instruction(comet_position_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawLiquidity<'info> {
    pub signer: Signer<'info>,
    #[account(
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        address = manager_info.incept
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        address = manager_info.incept_program
    )]
    pub incept_program: Program<'info, InceptProgram>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault
    )]
    pub incept_usdi_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].liquidity_token_mint,
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = manager_info,
    )]
    pub manager_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info,
    )]
    pub manager_usdi_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidity>,
    comet_position_index: u8,
    liquidity_token_amount: u64,
) -> Result<()> {
    // In normal operation, only the manager can access this instruction.
    // When forcefully closed, anyone can access this operation. When not-forcefully closed
    // this operation shouldn't be needed or used.
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

    // Calculate usdi value to withdraw according to tokens redeemed.
    // Withdraw collateral from comet
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];
    incept::cpi::withdraw_liquidity_from_comet(
        CpiContext::new_with_signer(
            ctx.accounts.incept_program.to_account_info(),
            WithdrawLiquidityFromComet {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.manager_incept_user.to_account_info(),
                incept: ctx.accounts.incept.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
                usdi_mint: ctx.accounts.usdi_mint.to_account_info(),
                iasset_mint: ctx.accounts.iasset_mint.to_account_info(),
                amm_usdi_token_account: ctx.accounts.amm_usdi_token_account.to_account_info(),
                amm_iasset_token_account: ctx.accounts.amm_iasset_token_account.to_account_info(),
                liquidity_token_mint: ctx.accounts.liquidity_token_mint.to_account_info(),
                comet_liquidity_token_account: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info(),
                user_iasset_token_account: ctx
                    .accounts
                    .manager_iasset_token_account
                    .to_account_info(),
                user_usdi_token_account: ctx.accounts.manager_usdi_token_account.to_account_info(),
            },
            manager_seeds,
        ),
        comet_position_index,
        liquidity_token_amount
    )
}
