use crate::error::*;
//use crate::instructions::MintUSDI;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( amount: u64)]
pub struct MintUSDI<'info> {
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

pub fn execute(ctx: Context<MintUSDI>, amount: u64) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let collateral = token_data.collaterals[USDC_COLLATERAL_INDEX];
    let collateral_scale = collateral.vault_mint_supply.to_decimal().scale();
    let user_usdc_amount = Decimal::new(
        ctx.accounts
            .user_collateral_token_account
            .amount
            .try_into()
            .unwrap(),
        collateral_scale,
    );

    let mut usdi_value =
        Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE).min(user_usdc_amount);
    usdi_value.rescale(DEVNET_TOKEN_SCALE);

    // check to see if the collateral used to mint usdi is stable
    let is_stable: Result<bool> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(InceptError::InvalidBool)),
    };

    // if collateral is not stable, we throw an error
    if !(is_stable.unwrap()) {
        return Err(InceptError::InvalidCollateralType.into());
    }

    // add collateral amount to vault supply
    let current_vault_usdi_supply = collateral.vault_usdi_supply.to_decimal();
    let mut new_vault_usdi_supply = current_vault_usdi_supply + usdi_value;
    new_vault_usdi_supply.rescale(collateral_scale);
    token_data.collaterals[USDC_COLLATERAL_INDEX].vault_usdi_supply =
        RawDecimal::from(new_vault_usdi_supply);

    // transfer user collateral to vault
    usdi_value.rescale(collateral_scale);
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        to: ctx.accounts.usdc_vault.to_account_info().clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        usdi_value.mantissa().try_into().unwrap(),
    )?;

    // mint usdi to user
    usdi_value.rescale(DEVNET_TOKEN_SCALE);
    let cpi_accounts = MintTo {
        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        usdi_value.mantissa().try_into().unwrap(),
    )?;

    Ok(())
}
