use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::AddCollateralToMint;

pub fn execute(
    ctx: Context<AddCollateralToMint>,
    _manager_nonce: u8,
    mint_index: u8,
    amount: u64,
) -> ProgramResult {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

    let collateral = token_data.collaterals
        [mint_positions.mint_positions[mint_index as usize].collateral_index as usize];
    let mint_position = mint_positions.mint_positions[mint_index as usize];

    let amount_value = Decimal::new(
        amount.try_into().unwrap(),
        collateral
            .vault_mint_supply
            .to_decimal()
            .scale()
            .try_into()
            .unwrap(),
    );

    // add collateral amount to vault supply
    token_data.collaterals
        [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
        .vault_mint_supply =
        RawDecimal::from(collateral.vault_mint_supply.to_decimal() + amount_value);

    // add collateral amount to mint data
    mint_positions.mint_positions[mint_index as usize].collateral_amount =
        RawDecimal::from(mint_position.collateral_amount.to_decimal() + amount_value);

    // send collateral to vault
    let cpi_ctx = CpiContext::from(&*ctx.accounts);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}
