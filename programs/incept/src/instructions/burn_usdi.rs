use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct BurnUSDI<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = usdi_mint,
        has_one = token_data
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].vault
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = user
    )]
    pub user_usdi_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = usdc_vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<BurnUSDI>, amount: u64) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let collateral = token_data.collaterals[USDC_COLLATERAL_INDEX];

    let collateral_scale = collateral.vault_mint_supply.to_decimal().scale();

    let user_usdi_amount = Decimal::new(
        ctx.accounts
            .user_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let usdi_value =
        Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE).min(user_usdi_amount);
    let collateral_value = rescale_toward_zero(usdi_value, collateral_scale);
    // subtract collateral amount to vault supply
    let current_vault_usdi_supply = collateral.vault_usdi_supply.to_decimal();
    let new_vault_usdi_supply = rescale_toward_zero(
        current_vault_usdi_supply - usdi_value,
        current_vault_usdi_supply.scale(),
    );
    token_data.collaterals[USDC_COLLATERAL_INDEX].vault_usdi_supply =
        RawDecimal::from(new_vault_usdi_supply);

    // transfer collateral from vault to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.usdc_vault.to_account_info().clone(),
        to: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        collateral_value.mantissa().try_into().unwrap(),
    )?;

    // Burn Usdi
    let cpi_accounts = Burn {
        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    Ok(())
}
