use crate::states::MockUsdc;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(mock_usdc_nonce: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        //seeds = [b"mock_usdc".as_ref()],
        //bump = mock_usdc_nonce,
        space = 8 + 32,
        payer = admin
    )]
    pub mock_usdc_account: Account<'info, MockUsdc>,
    #[account(
        init,
        mint::decimals = 7,
        mint::authority = mock_usdc_account,
        payer = admin
    )]
    pub mock_usdc_mint: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mock_usdc_nonce: u8)]
pub struct MintMockUSDC<'info> {
    #[account(mut)]
    pub mock_usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub mock_usdc_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"mock_usdc".as_ref()],
        bump = mock_usdc_nonce,
        has_one = mock_usdc_mint
    )]
    pub mock_usdc_account: Account<'info, MockUsdc>,
    pub token_program: Program<'info, Token>,
}
