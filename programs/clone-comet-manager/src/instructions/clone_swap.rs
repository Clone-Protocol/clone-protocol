use crate::error::CloneCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::cpi::accounts::{BuyOnAsset, SellOnAsset};
use clone::program::Clone as CloneProgram;
use clone::return_error_if_false;
use clone::states::{Clone, TokenData};

#[derive(Accounts)]
#[instruction(is_buy: bool, pool_index: u8, amount: u64, onusd_threshold: u64)]
pub struct CloneSwap<'info> {
    #[account(address = manager_info.owner)]
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
        associated_token::mint = onusd_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onusd_token_account,
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = manager_info
    )]
    pub manager_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].onasset_token_account,
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.clone_program
    )]
    pub clone_program: Program<'info, CloneProgram>,
    #[account(
        mut,
        address = clone.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<CloneSwap>,
    is_buy: bool,
    pool_index: u8,
    amount: u64,
    onusd_threshold: u64,
) -> Result<()> {
    // Calculate membership amount to mint
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        CloneCometManagerError::OpenStatusRequired
    );

    let owner = ctx.accounts.manager_info.owner.key();
    let manager_seeds = &[&[
        b"manager-info",
        owner.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.manager_info.bump),
    ][..]];

    if is_buy {
        clone::cpi::buy_onasset(
            CpiContext::new_with_signer(
                ctx.accounts.clone_program.to_account_info(),
                BuyOnAsset {
                    user: ctx.accounts.manager_info.to_account_info(),
                    clone: ctx.accounts.clone.to_account_info(),
                    token_data: ctx.accounts.token_data.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    user_onusd_token_account: ctx
                        .accounts
                        .manager_onusd_token_account
                        .to_account_info(),
                    user_onasset_token_account: ctx
                        .accounts
                        .manager_onasset_token_account
                        .to_account_info(),
                    treasury_onasset_token_account: ctx
                        .accounts
                        .treasury_onasset_token_account
                        .to_account_info(),
                    amm_onusd_token_account: ctx.accounts.amm_onusd_token_account.to_account_info(),
                    amm_onasset_token_account: ctx
                        .accounts
                        .amm_onasset_token_account
                        .to_account_info(),
                },
                manager_seeds,
            ),
            pool_index,
            amount,
            onusd_threshold,
        )?;
    } else {
        clone::cpi::sell_onasset(
            CpiContext::new_with_signer(
                ctx.accounts.clone_program.to_account_info(),
                SellOnAsset {
                    user: ctx.accounts.manager_info.to_account_info(),
                    clone: ctx.accounts.clone.to_account_info(),
                    token_data: ctx.accounts.token_data.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    user_onusd_token_account: ctx
                        .accounts
                        .manager_onusd_token_account
                        .to_account_info(),
                    user_onasset_token_account: ctx
                        .accounts
                        .manager_onasset_token_account
                        .to_account_info(),
                    treasury_onusd_token_account: ctx
                        .accounts
                        .treasury_onusd_token_account
                        .to_account_info(),
                    amm_onusd_token_account: ctx.accounts.amm_onusd_token_account.to_account_info(),
                    amm_onasset_token_account: ctx
                        .accounts
                        .amm_onasset_token_account
                        .to_account_info(),
                },
                manager_seeds,
            ),
            pool_index,
            amount,
            onusd_threshold,
        )?;
    }

    Ok(())
}
