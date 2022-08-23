use crate::error::*;
use crate::instructions::MintUSDI;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub fn execute(ctx: Context<MintUSDI>, manager_nonce: u8, amount: u64) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let (collateral, collateral_index) =
        TokenData::get_collateral_tuple(token_data, *ctx.accounts.vault.to_account_info().key)
            .unwrap();
    let collateral_scale = collateral.vault_mint_supply.to_decimal().scale();

    let mut usdi_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let collateral_value = Decimal::from_str(
        &ctx.accounts
            .user_collateral_token_account
            .amount
            .to_string(),
    )
    .unwrap()
        / Decimal::new(1, collateral_scale.try_into().unwrap());

    // check to see if the collateral used to mint usdi is stable
    let is_stable: Result<bool, InceptError> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(InceptError::InvalidBool),
    };

    // if collateral is not stable, we throw an error
    if !(is_stable.unwrap()) {
        return Err(InceptError::InvalidCollateralType.into());
    }

    // check if their is sufficient collateral to mint
    if usdi_value > collateral_value {
        return Err(InceptError::InsufficientCollateral.into());
    }

    // add collateral amount to vault supply
    token_data.collaterals[collateral_index].vault_usdi_supply =
        RawDecimal::from(collateral.vault_usdi_supply.to_decimal() + collateral_value);

    // transfer user collateral to vault
    usdi_value.rescale(collateral_scale.try_into().unwrap());
    let cpi_ctx_transfer: CpiContext<Transfer> = CpiContext::from(&*ctx.accounts);
    token::transfer(cpi_ctx_transfer, usdi_value.mantissa().try_into().unwrap())?;

    // mint usdi to user
    let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
    token::mint_to(cpi_ctx_mint, amount)?;

    Ok(())
}
