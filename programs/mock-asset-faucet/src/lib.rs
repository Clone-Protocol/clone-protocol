use anchor_lang::prelude::*;
use anchor_spl::token::*;

declare_id!("AebpPDV1MsHNJ7Heqbzd8hTrQXFJk3hoMcChKqMQCuKW");

const MOCK_FAUCET_SEED: &str = "faucet";

#[account]
pub struct MockFaucet {
    pub mint: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 32 + 8,
        seeds = [MOCK_FAUCET_SEED.as_ref()],
        bump,
        payer = payer
    )]
    pub faucet: Account<'info, MockFaucet>,
    #[account(
        mint::authority = faucet
    )]
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MintAsset<'info> {
    pub minter: Signer<'info>,
    #[account(
        seeds = [MOCK_FAUCET_SEED.as_ref()],
        bump,
    )]
    pub faucet: Account<'info, MockFaucet>,
    #[account(
        mut,
        address = faucet.mint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = minter
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[program]
pub mod mock_asset_faucet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.faucet.mint = ctx.accounts.mint.key();
        Ok(())
    }

    pub fn mint_asset(ctx: Context<MintAsset>, amount: u64) -> Result<()> {
        let bump = ctx.bumps.faucet;
        let seeds = &[&[MOCK_FAUCET_SEED.as_ref(), bytemuck::bytes_of(&bump)][..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info().clone(),
            to: ctx.accounts.token_account.to_account_info().clone(),
            authority: ctx.accounts.faucet.to_account_info().clone(),
        };
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                seeds,
            ),
            amount,
        )?;
        Ok(())
    }
}
