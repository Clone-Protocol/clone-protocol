use anchor_lang::prelude::*;
use anchor_spl::token::*;
use anchor_spl::token::{self, MintTo};
use pyth::pc::Price;
use rust_decimal::prelude::*;
use std::convert::TryInto;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const DEVNET_TOKEN_SCALE: u8 = 8;
const USDC_TOKEN_SCALE: u8 = 7;
const NUM_IASSETS: usize = 10;

/// Lib
#[program]
pub mod jupiter_agg_mock {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, _nonce: u8) -> ProgramResult {
        ctx.accounts.jupiter_account.usdc_mint = *ctx.accounts.usdc_mint.to_account_info().key;
        Ok(())
    }

    pub fn create_iasset(ctx: Context<CreateIasset>, pyth_oracle: Pubkey) -> ProgramResult {
        let jupiter = &mut ctx.accounts.jupiter_account;
        jupiter.add_iasset(*ctx.accounts.iasset_mint.to_account_info().key, pyth_oracle);
        Ok(())
    }

    pub fn mint_iasset(
        ctx: Context<MintIasset>,
        nonce: u8,
        _iasset_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"jupiter", bytemuck::bytes_of(&nonce)][..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            to: ctx.accounts.iasset_token_account.to_account_info().clone(),
            authority: ctx.accounts.jupiter_account.to_account_info().clone(),
        };
        let mint_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::mint_to(mint_iasset_context, amount)?;

        Ok(())
    }

    pub fn mint_usdc(ctx: Context<MintUsdc>, nonce: u8, amount: u64) -> ProgramResult {
        let seeds = &[&[b"jupiter", bytemuck::bytes_of(&nonce)][..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.usdc_mint.to_account_info().clone(),
            to: ctx.accounts.usdc_token_account.to_account_info().clone(),
            authority: ctx.accounts.jupiter_account.to_account_info().clone(),
        };
        let mint_usdc_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::mint_to(mint_usdc_context, amount)?;

        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        nonce: u8,
        _iasset_index: u8,
        buy: bool,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"jupiter", bytemuck::bytes_of(&nonce)][..]];
        // Get oracle price
        let price_feed = Price::load(&ctx.accounts.pyth_oracle)?;
        let price = Decimal::new(
            price_feed.agg.price.try_into().unwrap(),
            price_feed.expo.abs().try_into().unwrap(),
        );
        let amount_decimal = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE.into());
        let mut usdc_amount = amount_decimal * price;
        usdc_amount.rescale(USDC_TOKEN_SCALE.into());

        if buy {
            // Mint iasset to user
            let cpi_accounts = MintTo {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.jupiter_account.to_account_info().clone(),
            };
            let mint_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::mint_to(mint_iasset_context, amount)?;

            // Burn usdc from user.
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdc_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_usdc_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            };
            let burn_usdi_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(
                burn_usdi_context,
                usdc_amount.mantissa().try_into().unwrap(),
            )?;
        } else {
            // Mint Usdc to user
            let cpi_accounts = MintTo {
                mint: ctx.accounts.usdc_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_usdc_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.jupiter_account.to_account_info().clone(),
            };
            let mint_usdc_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::mint_to(
                mint_usdc_context,
                usdc_amount.mantissa().try_into().unwrap(),
            )?;

            // Burn Iasset from user.
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, amount)?;
        }

        Ok(())
    }
}

/// Instructions
#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct Initialize<'info> {
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + 673,
        seeds = [b"jupiter".as_ref()],
        bump = nonce,
    )]
    pub jupiter_account: Account<'info, Jupiter>,
    #[account(
        init,
        mint::decimals = USDC_TOKEN_SCALE,
        mint::authority = jupiter_account,
        payer = admin
    )]
    pub usdc_mint: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pyth_oracle: Pubkey)]
pub struct CreateIasset<'info> {
    payer: Signer<'info>,
    #[account(
        init,
        mint::decimals = DEVNET_TOKEN_SCALE,
        mint::authority = jupiter_account,
        payer = payer
    )]
    pub iasset_mint: Account<'info, Mint>,
    #[account(mut)]
    pub jupiter_account: Account<'info, Jupiter>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u8, iasset_index: u8, amount: u64)]
pub struct MintIasset<'info> {
    #[account(
        mut,
        address = jupiter_account.iasset_mints[iasset_index as usize]
    )]
    pub iasset_mint: Account<'info, Mint>,
    #[account(mut)]
    pub iasset_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"jupiter".as_ref()],
        bump = nonce,
    )]
    pub jupiter_account: Account<'info, Jupiter>,
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(nonce: u8, amount: u64)]
pub struct MintUsdc<'info> {
    #[account(mut)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub usdc_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"jupiter".as_ref()],
        bump = nonce,
    )]
    pub jupiter_account: Account<'info, Jupiter>,
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(nonce: u8, iasset_index: u8, buy: bool, amount: u64)]
pub struct Swap<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"jupiter".as_ref()],
        bump = nonce,
    )]
    pub jupiter_account: Box<Account<'info, Jupiter>>,
    #[account(mut,
        address = jupiter_account.iasset_mints[iasset_index as usize]
    )]
    pub iasset_mint: Account<'info, Mint>,
    #[account(mut,
        address = jupiter_account.usdc_mint
    )]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = user,
    )]
    pub user_iasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = jupiter_account.usdc_mint,
        associated_token::authority = user,
    )]
    pub user_usdc_token_account: Account<'info, TokenAccount>,
    #[account(
        address = jupiter_account.oracles[iasset_index as usize]
    )]
    pub pyth_oracle: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

// TODO: Write a wrapper around this.
// pub struct RaydiumSwap<'info> {
//     pub token_program: AccountInfo<'info>,
//     pub ammId: Account<'info, TokenAccount>,
//     pub ammAuthority: Account<'info, TokenAccount>,
//     pub ammOpenOrders: Account<'info, TokenAccount>,
//     pub ammTargetOrders: Account<'info, TokenAccount>,
//     pub poolCoinTokenAccount: Account<'info, TokenAccount>,
//     pub poolPcTokenAccount: Account<'info, TokenAccount>,
//     pub serumProgramId: Account<'info, TokenAccount>,
//     pub serumMarket: Account<'info, TokenAccount>,
//     pub serumBids: Account<'info, TokenAccount>,
//     pub serumAsks: Account<'info, TokenAccount>,
//     pub serumEventQueue: Account<'info, TokenAccount>,
//     pub serumCoinVaultAccount: Account<'info, TokenAccount>,
//     pub serumPcVaultAccount: Account<'info, TokenAccount>,
//     pub serumVaultSigner: Account<'info, TokenAccount>,
//     pub userSourceTokenAccount: Account<'info, TokenAccount>,
//     pub userDestinationTokenAccount: Account<'info, TokenAccount>,
//     pub userSourceOwner: Account<'info, TokenAccount>,
// }

/// States
#[account]
#[derive(Default)]
pub struct Jupiter {
    // 673
    pub usdc_mint: Pubkey,                   // 32
    pub iasset_mints: [Pubkey; NUM_IASSETS], // 32 * 10 = 320
    pub oracles: [Pubkey; NUM_IASSETS],      // 32 * 10 = 320
    pub n_iassets: u8,                       // 1
}

impl Jupiter {
    pub fn add_iasset(&mut self, mint_address: Pubkey, oracle: Pubkey) {
        assert!((self.n_iassets as usize) < self.iasset_mints.len());
        self.iasset_mints[self.n_iassets as usize] = mint_address;
        self.oracles[self.n_iassets as usize] = oracle;
        self.n_iassets += 1;
    }
}
