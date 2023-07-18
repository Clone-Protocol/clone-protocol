use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( amount: u64)]
pub struct MintONUSD<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = onusd_mint,
        has_one = token_data
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].vault
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = user
    )]
    pub user_onusd_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = usdc_vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<MintONUSD>, amount: u64) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
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

    let onusd_value = rescale_toward_zero(
        Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE).min(user_usdc_amount),
        CLONE_TOKEN_SCALE,
    );

    // check to see if the collateral used to mint onusd is stable
    let is_stable: Result<bool> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(CloneError::InvalidBool)),
    };

    // if collateral is not stable, we throw an error
    if !(is_stable.unwrap()) {
        return Err(CloneError::InvalidCollateralType.into());
    }

    // add collateral amount to vault supply
    let current_vault_onusd_supply = collateral.vault_onusd_supply.to_decimal();
    let new_vault_onusd_supply =
        rescale_toward_zero(current_vault_onusd_supply + onusd_value, collateral_scale);
    token_data.collaterals[USDC_COLLATERAL_INDEX].vault_onusd_supply =
        RawDecimal::from(new_vault_onusd_supply);

    // transfer user collateral to vault
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
        rescale_toward_zero(onusd_value, collateral_scale)
            .mantissa()
            .try_into()
            .unwrap(),
    )?;

    // mint onusd to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.onusd_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_onusd_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        onusd_value.mantissa().try_into().unwrap(),
    )?;

    Ok(())
}
