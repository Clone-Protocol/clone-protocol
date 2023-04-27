use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::{BuyIasset, SellIasset};
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{Incept, TokenData};

#[derive(Accounts)]
#[instruction(is_buy: bool, pool_index: u8, amount: u64, usdi_threshold: u64)]
pub struct InceptSwap<'info> {
    #[account(address = manager_info.owner)]
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
        associated_token::mint = usdi_mint,
        associated_token::authority = incept.treasury_address
    )]
    pub treasury_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
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
        associated_token::mint = iasset_mint,
        associated_token::authority = incept.treasury_address
    )]
    pub treasury_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
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
}

pub fn execute(
    ctx: Context<InceptSwap>,
    is_buy: bool,
    pool_index: u8,
    amount: u64,
    usdi_threshold: u64,
) -> Result<()> {
    // Calculate membership amount to mint
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        InceptCometManagerError::OpenStatusRequired
    );

    let owner = ctx.accounts.manager_info.owner.key();
    let manager_seeds = &[&[
        b"manager-info",
        owner.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.manager_info.bump),
    ][..]];

    if is_buy {
        incept::cpi::buy_iasset(
            CpiContext::new_with_signer(
                ctx.accounts.incept_program.to_account_info(),
                BuyIasset {
                    user: ctx.accounts.manager_info.to_account_info(),
                    incept: ctx.accounts.incept.to_account_info(),
                    token_data: ctx.accounts.token_data.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    user_usdi_token_account: ctx
                        .accounts
                        .manager_usdi_token_account
                        .to_account_info(),
                    user_iasset_token_account: ctx
                        .accounts
                        .manager_iasset_token_account
                        .to_account_info(),
                    treasury_iasset_token_account: ctx
                        .accounts
                        .treasury_iasset_token_account
                        .to_account_info(),
                    amm_usdi_token_account: ctx.accounts.amm_usdi_token_account.to_account_info(),
                    amm_iasset_token_account: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info(),
                },
                manager_seeds,
            ),
            pool_index,
            amount,
            usdi_threshold,
        )?;
    } else {
        incept::cpi::sell_iasset(
            CpiContext::new_with_signer(
                ctx.accounts.incept_program.to_account_info(),
                SellIasset {
                    user: ctx.accounts.manager_info.to_account_info(),
                    incept: ctx.accounts.incept.to_account_info(),
                    token_data: ctx.accounts.token_data.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    user_usdi_token_account: ctx
                        .accounts
                        .manager_usdi_token_account
                        .to_account_info(),
                    user_iasset_token_account: ctx
                        .accounts
                        .manager_iasset_token_account
                        .to_account_info(),
                    treasury_usdi_token_account: ctx
                        .accounts
                        .treasury_usdi_token_account
                        .to_account_info(),
                    amm_usdi_token_account: ctx.accounts.amm_usdi_token_account.to_account_info(),
                    amm_iasset_token_account: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info(),
                },
                manager_seeds,
            ),
            pool_index,
            amount,
            usdi_threshold,
        )?;
    }

    Ok(())
}
