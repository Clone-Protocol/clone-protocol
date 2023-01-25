use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use instructions::*;

mod instructions;
mod states;

declare_id!("J4wFpMDiqxGPV4YkmaUYtCaPVRoSHcTN9EsaC1NsmfNi");

#[program]
pub mod mock_usdc {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, _mock_usdc_nonce: u8) -> ProgramResult {
        ctx.accounts.mock_usdc_account.mock_usdc_mint =
            *ctx.accounts.mock_usdc_mint.to_account_info().key;

        Ok(())
    }

    pub fn mint_mock_usdc(ctx: Context<MintMockUSDC>, mock_usdc_nonce: u8) -> ProgramResult {
        let seeds = &[&[b"mock_usdc", bytemuck::bytes_of(&mock_usdc_nonce)][..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mock_usdc_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .mock_usdc_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.mock_usdc_account.to_account_info().clone(),
        };
        let mint_mock_usdc_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::mint_to(mint_mock_usdc_context, 10000000000000000000)?;

        Ok(())
    }
}
