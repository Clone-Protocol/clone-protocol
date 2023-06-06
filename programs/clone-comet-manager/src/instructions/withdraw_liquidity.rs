use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::WithdrawLiquidityFromComet;
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{Comet, Clone, TokenData, User, ONUSD_COLLATERAL_INDEX};

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
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onusd_token_account,
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onasset_token_account,
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
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
        associated_token::mint = onasset_mint,
        associated_token::authority = manager_info,
    )]
    pub manager_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_info,
    )]
    pub manager_onusd_token_account: Box<Account<'info, TokenAccount>>,
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

    // Calculate onusd value to withdraw according to tokens redeemed.
    // Withdraw collateral from comet
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];
    clone::cpi::withdraw_liquidity_from_comet(
        CpiContext::new_with_signer(
            ctx.accounts.clone_program.to_account_info(),
            WithdrawLiquidityFromComet {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.manager_clone_user.to_account_info(),
                clone: ctx.accounts.clone.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
                onusd_mint: ctx.accounts.onusd_mint.to_account_info(),
                onasset_mint: ctx.accounts.onasset_mint.to_account_info(),
                amm_onusd_token_account: ctx.accounts.amm_onusd_token_account.to_account_info(),
                amm_onasset_token_account: ctx.accounts.amm_onasset_token_account.to_account_info(),
                liquidity_token_mint: ctx.accounts.liquidity_token_mint.to_account_info(),
                comet_liquidity_token_account: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info(),
                user_onasset_token_account: ctx
                    .accounts
                    .manager_onasset_token_account
                    .to_account_info(),
                user_onusd_token_account: ctx.accounts.manager_onusd_token_account.to_account_info(),
            },
            manager_seeds,
        ),
        comet_position_index,
        liquidity_token_amount,
    )
}
