use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::WithdrawLiquidityFromComet;
use incept::program::Incept;
use incept::states::{Comet, Manager, TokenData, User, USDI_COLLATERAL_INDEX};

#[derive(Accounts)]
#[instruction(comet_position_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawLiquidity<'info> {
    pub manager_owner: Signer<'info>,
    #[account(
        seeds = [b"manager-info", manager_owner.key.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.incept_manager
    )]
    pub incept_manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        mut,
        address = incept_manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        address = manager_info.incept
    )]
    pub incept_program: Program<'info, Incept>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept_manager.token_data
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
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidity>,
    comet_position_index: u8,
    liquidity_token_amount: u64,
) -> Result<()> {
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
                manager: ctx.accounts.incept_manager.to_account_info(),
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
                vault: ctx.accounts.incept_usdi_vault.to_account_info(),
            },
            manager_seeds,
        ),
        ctx.accounts.incept_manager.bump,
        comet_position_index,
        liquidity_token_amount,
        0,
    )
}
