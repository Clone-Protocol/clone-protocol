use anchor_lang::prelude::*;
use anchor_spl::token::*;
use anchor_spl::token::{self, MintTo};
use pyth::pc::Price;
use rust_decimal::prelude::*;
use std::convert::TryInto;

declare_id!("7BhcWQNaNiEBd9SW7xMGSJYDP7NQ9VRMLYaRZD1QjZh5");

const DEVNET_TOKEN_SCALE: u32 = 8;
const USDC_TOKEN_SCALE: u8 = 7;
const NUM_ASSETS: usize = 10;

/// Lib
#[program]
pub mod jupiter_agg_mock {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let jupiter_account = &mut ctx.accounts.jupiter_account.load_init()?;
        jupiter_account.usdc_mint = *ctx.accounts.usdc_mint.to_account_info().key;
        if let Some(bump) = ctx.bumps.get("jupiter") {
            jupiter_account.bump = *bump;
        }
        //jupiter_account.bump = *ctx.bumps.get("jupiter").expect("Couldn't find bump");
        Ok(())
    }

    pub fn create_asset(ctx: Context<CreateAsset>, pyth_oracle: Pubkey) -> Result<()> {
        let jupiter_account = &mut ctx.accounts.jupiter_account.load_mut()?;
        jupiter_account.add_asset(*ctx.accounts.asset_mint.to_account_info().key, pyth_oracle);
        Ok(())
    }

    pub fn mint_asset(
        ctx: Context<MintAsset>,
        nonce: u8,
        _asset_index: u8,
        amount: u64,
    ) -> Result<()> {
        let seeds = &[&[b"jupiter", bytemuck::bytes_of(&nonce)][..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.asset_mint.to_account_info().clone(),
            to: ctx.accounts.asset_token_account.to_account_info().clone(),
            authority: ctx.accounts.jupiter_account.to_account_info().clone(),
        };
        let mint_asset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::mint_to(mint_asset_context, amount)?;

        Ok(())
    }

    pub fn mint_usdc(ctx: Context<MintUsdc>, nonce: u8, amount: u64) -> Result<()> {
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

    // `is_amount_input` is if the amount you are providing is the amount you want to put into the pool
    // otherwise its the amount you want to pull out of the pool. `is_amount_asset` specifies if the amount is
    // asset or usdc

    pub fn swap(
        ctx: Context<Swap>,
        nonce: u8,
        _asset_index: u8,
        is_amount_input: bool,
        is_amount_asset: bool,
        amount: u64,
    ) -> Result<()> {
        let seeds = &[&[b"jupiter", bytemuck::bytes_of(&nonce)][..]];

        // Get oracle price
        let price_feed = Price::load(&ctx.accounts.pyth_oracle)?;
        let price = rust_decimal::Decimal::new(
            price_feed.agg.price,
            price_feed.expo.abs().try_into().unwrap(),
        );

        if is_amount_asset {
            let iasset_decimal =
                rust_decimal::Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
            let mut usdc_amount = iasset_decimal * price;
            usdc_amount.rescale(USDC_TOKEN_SCALE.into());

            if is_amount_input {
                // burn amount asset
                let cpi_accounts = Burn {
                    mint: ctx.accounts.asset_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .user_asset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                };
                let burn_asset_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::burn(burn_asset_context, amount)?;

                // mint usdc
                let cpi_accounts = MintTo {
                    mint: ctx.accounts.usdc_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_usdc_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.jupiter_account.to_account_info().clone(),
                };
                let mint_asset_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::mint_to(
                    mint_asset_context,
                    usdc_amount.mantissa().try_into().unwrap(),
                )?;
            } else {
                // mint amount asset
                let cpi_accounts = MintTo {
                    mint: ctx.accounts.asset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_asset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.jupiter_account.to_account_info().clone(),
                };
                let mint_asset_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::mint_to(mint_asset_context, amount)?;

                // burn usdc
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdc_mint.to_account_info().clone(),
                    from: ctx
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
                token::burn(burn_usdi_context, amount)?;
            }
        } else {
            let usdi_decimal =
                rust_decimal::Decimal::new(amount.try_into().unwrap(), USDC_TOKEN_SCALE.into());
            let mut asset_amount = usdi_decimal / price;
            asset_amount.rescale(DEVNET_TOKEN_SCALE);

            if is_amount_input {
                // burn amount usdc
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdc_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .user_usdc_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                };
                let burn_usdc_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::burn(burn_usdc_context, amount)?;

                // mint asset
                let cpi_accounts = MintTo {
                    mint: ctx.accounts.asset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_asset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.jupiter_account.to_account_info().clone(),
                };
                let mint_asset_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::mint_to(
                    mint_asset_context,
                    asset_amount.mantissa().try_into().unwrap(),
                )?;
            } else {
                // mint amount usdc
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
                token::mint_to(mint_usdc_context, amount)?;

                // burn asset
                let cpi_accounts = Burn {
                    mint: ctx.accounts.asset_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .user_asset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                };
                let burn_asset_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::burn(
                    burn_asset_context,
                    asset_amount.mantissa().try_into().unwrap(),
                )?;
            }
        }

        Ok(())
    }
}

/// Instructions
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 690 + 8,
        seeds = [b"jupiter"],
        bump,
    )]
    pub jupiter_account: AccountLoader<'info, Jupiter>,
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
pub struct CreateAsset<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        mint::decimals = DEVNET_TOKEN_SCALE as u8,
        mint::authority = jupiter_account,
        payer = payer
    )]
    pub asset_mint: Account<'info, Mint>,
    #[account(mut)]
    pub jupiter_account: AccountLoader<'info, Jupiter>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u8, asset_index: u8, amount: u64)]
pub struct MintAsset<'info> {
    #[account(
        mut,
        address = jupiter_account.load()?.asset_mints[asset_index as usize]
    )]
    pub asset_mint: Account<'info, Mint>,
    #[account(mut)]
    pub asset_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"jupiter".as_ref()],
        bump = nonce,
    )]
    pub jupiter_account: AccountLoader<'info, Jupiter>,
    pub token_program: Program<'info, Token>,
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
    pub jupiter_account: AccountLoader<'info, Jupiter>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(nonce: u8, asset_index: u8, buy: bool, amount: u64)]
pub struct Swap<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"jupiter".as_ref()],
        bump = nonce,
    )]
    pub jupiter_account: AccountLoader<'info, Jupiter>,
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
        constraint = user_asset_token_account.mint == asset_mint.key(),
        constraint = user_asset_token_account.owner == user.key()
    )]
    pub user_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_usdc_token_account.mint == jupiter_account.load()?.usdc_mint.key(),
        constraint = user_asset_token_account.owner == user.key()
    )]
    pub user_usdc_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: Mock program
    #[account(
        address = jupiter_account.load()?.oracles[asset_index as usize]
    )]
    pub pyth_oracle: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
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
#[zero_copy]
#[derive(Eq, PartialEq, Default, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct RawDecimal {
    data: [u8; 16],
}

impl RawDecimal {
    pub fn from(decimal: &Decimal) -> Self {
        RawDecimal {
            data: decimal.serialize(),
        }
    }
    pub fn to_decimal(&self) -> Decimal {
        Decimal::deserialize(self.data)
    }
}

#[account(zero_copy)]
#[derive(Default)]
pub struct Jupiter {
    // 690, 704
    pub usdc_mint: Pubkey,                 // 32
    pub asset_mints: [Pubkey; NUM_ASSETS], // 32 * 10 = 320
    pub oracles: [Pubkey; NUM_ASSETS],     // 32 * 10 = 320
    pub answer: RawDecimal,                // 16
    pub n_assets: u8,                      // 1
    pub bump: u8,                          // 1
}

impl Jupiter {
    pub fn add_asset(&mut self, mint_address: Pubkey, oracle: Pubkey) {
        assert!((self.n_assets as usize) < self.asset_mints.len());
        self.asset_mints[self.n_assets as usize] = mint_address;
        self.oracles[self.n_assets as usize] = oracle;
        self.n_assets += 1;
    }
}
