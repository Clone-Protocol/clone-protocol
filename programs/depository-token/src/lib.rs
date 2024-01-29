use anchor_lang::prelude::*;
use anchor_spl::token::{
    burn as burn_from, mint_to, transfer, Burn, Mint, MintTo, Token, TokenAccount, Transfer,
};

declare_id!("CKR5jEyuHARhPN47yWS3GA6RauPbAg29hiNVC5ydV2ur");

#[program]
pub mod depository_token {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        ratio: u64,
        depositing_token_mint: Pubkey,
    ) -> Result<()> {
        *ctx.accounts.settings = Settings {
            ratio,
            depositing_token_mint,
            depositing_token_account: ctx.accounts.depositing_token_account.key(),
            depository_token_mint: ctx.accounts.depository_token_mint.key(),
        };

        Ok(())
    }

    pub fn mint_depository_token(
        ctx: Context<MintDepositoryToken>,
        mint_amount: u64,
    ) -> Result<()> {
        require!(mint_amount > 0, DepositoryTokenError::MustBeNonZero);
        // Calculate how much we need to mint.
        let depositing_token_amount = mint_amount * ctx.accounts.settings.ratio;
        let settings_bump = *ctx
            .bumps
            .get("settings")
            .ok_or(error!(DepositoryTokenError::CouldNotGetSettingsBump))?;

        // Transfer from user to depository.
        let cpi_program = ctx.accounts.token_program.to_account_info();
        transfer(
            CpiContext::new(
                cpi_program.clone(),
                Transfer {
                    from: ctx.accounts.user_depositing_token_account.to_account_info(),
                    to: ctx.accounts.depositing_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            depositing_token_amount,
        )?;

        // Mint depository tokens.
        mint_to(
            CpiContext::new_with_signer(
                cpi_program.clone(),
                MintTo {
                    mint: ctx.accounts.depository_token_mint.to_account_info(),
                    to: ctx.accounts.user_depository_token_account.to_account_info(),
                    authority: ctx.accounts.settings.to_account_info(),
                },
                &[&[SETTINGS_SEED.as_bytes(), &[settings_bump]]],
            ),
            mint_amount,
        )?;

        Ok(())
    }

    pub fn redeem_depository_token(
        ctx: Context<RedeemDepositoryToken>,
        redeem_amount: u64,
    ) -> Result<()> {
        require!(redeem_amount > 0, DepositoryTokenError::MustBeNonZero);
        // Calculate how much we need to redeem.
        let depositing_token_amount = redeem_amount * ctx.accounts.settings.ratio;
        let settings_bump = *ctx
            .bumps
            .get("settings")
            .ok_or(error!(DepositoryTokenError::CouldNotGetSettingsBump))?;

        // Transfer from depository to user.
        let cpi_program = ctx.accounts.token_program.to_account_info();
        transfer(
            CpiContext::new_with_signer(
                cpi_program.clone(),
                Transfer {
                    from: ctx.accounts.depositing_token_account.to_account_info(),
                    to: ctx.accounts.user_depositing_token_account.to_account_info(),
                    authority: ctx.accounts.settings.to_account_info(),
                },
                &[&[SETTINGS_SEED.as_bytes(), &[settings_bump]]],
            ),
            depositing_token_amount,
        )?;

        // Burn depository tokens.
        burn_from(
            CpiContext::new(
                cpi_program.clone(),
                Burn {
                    mint: ctx.accounts.depository_token_mint.to_account_info(),
                    from: ctx.accounts.user_depository_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            redeem_amount,
        )?;

        Ok(())
    }
}

/// ON CHAIN ACCOUNTS.

pub const SETTINGS_SEED: &str = "settings";

#[account]
pub struct Settings {
    pub ratio: u64,
    pub depositing_token_mint: Pubkey, // The token mint that is deposited to mint depository tokens.
    pub depositing_token_account: Pubkey,
    pub depository_token_mint: Pubkey, // The minted token.
}

/// INSTRUCTIONS
#[derive(Accounts)]
#[instruction(ratio: u64, depositing_token_mint: Pubkey)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 32 * 3 + 8 + 8,
        seeds = [SETTINGS_SEED.as_ref()],
        bump,
        payer = payer
    )]
    pub settings: Account<'info, Settings>,
    #[account(
        mint::authority = settings,
        constraint = depository_token_mint.key() != depositing_token_mint @ DepositoryTokenError::MintsMustBeDifferent,
    )]
    pub depository_token_mint: Account<'info, Mint>,
    #[account(
        associated_token::mint = depositing_token_mint,
        associated_token::authority = settings,
    )]
    pub depositing_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mint_amount: u64)]

pub struct MintDepositoryToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [SETTINGS_SEED.as_ref()],
        bump,
    )]
    pub settings: Account<'info, Settings>,
    #[account(
        mut,
        address = settings.depository_token_mint,
    )]
    pub depository_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        address = settings.depositing_token_account
    )]
    pub depositing_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = settings.depositing_token_mint,
        associated_token::authority = user,
    )]
    pub user_depositing_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = depository_token_mint,
        associated_token::authority = user,
    )]
    pub user_depository_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(redeem_amount: u64)]

pub struct RedeemDepositoryToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [SETTINGS_SEED.as_ref()],
        bump,
    )]
    pub settings: Account<'info, Settings>,
    #[account(
        mut,
        address = settings.depository_token_mint,
    )]
    pub depository_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        address = settings.depositing_token_account
    )]
    pub depositing_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = settings.depositing_token_mint,
        associated_token::authority = user,
    )]
    pub user_depositing_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = depository_token_mint,
        associated_token::authority = user,
    )]
    pub user_depository_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum DepositoryTokenError {
    #[msg("Couldn't retrieve the settings bump!")]
    CouldNotGetSettingsBump,

    #[msg("Amount must be non-zero")]
    MustBeNonZero,

    #[msg("Depository and depositing token mints must be different!")]
    MintsMustBeDifferent,
}
