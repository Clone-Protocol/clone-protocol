use crate::error::InceptCometManagerError;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::return_error_if_false;
use jupiter_agg_mock::cpi::accounts::Swap;
use jupiter_agg_mock::program::JupiterAggMock;
use jupiter_agg_mock::Jupiter;

#[derive(Accounts)]
#[instruction(jupiter_nonce: u8, is_buy: bool, asset_index: u8, amount: u64)]
pub struct JupiterMockSwap<'info> {
    #[account(address = manager_info.owner)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(mut,
        address = jupiter_account.load()?.asset_mints[asset_index as usize]
    )]
    pub asset_mint: Box<Account<'info, Mint>>,
    #[account(mut,
        address = jupiter_account.load()?.usdc_mint
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = manager_info
    )]
    pub manager_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdc_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.incept_program
    )]
    pub jupiter_program: Program<'info, JupiterAggMock>,
    #[account(
        seeds = [b"jupiter".as_ref()],
        bump = jupiter_nonce,
    )]
    pub jupiter_account: AccountLoader<'info, Jupiter>,
    pub token_program: Program<'info, Token>,
    /// CHECK: Mock program
    #[account(
        address = jupiter_account.load()?.oracles[asset_index as usize]
    )]
    pub pyth_oracle: AccountInfo<'info>,
}

pub fn execute(
    ctx: Context<JupiterMockSwap>,
    jupiter_nonce: u8,
    is_buy: bool,
    asset_index: u8,
    amount: u64,
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

    jupiter_agg_mock::cpi::swap(
        CpiContext::new_with_signer(
            ctx.accounts.jupiter_program.to_account_info(),
            Swap {
                user: ctx.accounts.manager_info.to_account_info(),
                jupiter_account: ctx.accounts.jupiter_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                user_usdc_token_account: ctx.accounts.manager_usdc_token_account.to_account_info(),
                user_asset_token_account: ctx
                    .accounts
                    .manager_asset_token_account
                    .to_account_info(),
                asset_mint: ctx.accounts.asset_mint.to_account_info(),
                usdc_mint: ctx.accounts.usdc_mint.to_account_info(),
                pyth_oracle: ctx.accounts.pyth_oracle.to_account_info(),
            },
            manager_seeds,
        ),
        jupiter_nonce,
        asset_index,
        !is_buy,
        true,
        amount,
    )?;

    Ok(())
}
