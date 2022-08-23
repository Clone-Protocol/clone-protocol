use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::WithdrawCollateralFromMint;

pub fn execute(
    ctx: Context<WithdrawCollateralFromMint>,
    manager_nonce: u8,
    mint_index: u8,
    amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

    let pool_index = mint_positions.mint_positions[mint_index as usize].pool_index;
    let pool = token_data.pools[pool_index as usize];
    let collateral_ratio = pool.asset_info.stable_collateral_ratio;
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

    // subtract collateral amount from vault supply
    token_data.collaterals
        [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
        .vault_mint_supply =
        RawDecimal::from(collateral.vault_mint_supply.to_decimal() - amount_value);

    // subtract collateral amount from mint data
    mint_positions.mint_positions[mint_index as usize].collateral_amount =
        RawDecimal::from(mint_position.collateral_amount.to_decimal() - amount_value);
    let slot = Clock::get()?.slot;

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool.asset_info,
        mint_position.borrowed_iasset.to_decimal(),
        collateral_ratio.to_decimal(),
        mint_positions.mint_positions[mint_index as usize]
            .collateral_amount
            .to_decimal(),
        slot,
    )
    .unwrap();

    // send collateral back to user
    let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
    token::transfer(cpi_ctx, amount)?;

    // check to see if mint is empty, if so remove
    if mint_positions.mint_positions[mint_index as usize]
        .collateral_amount
        .to_decimal()
        .is_zero()
    {
        mint_positions.remove(mint_index as usize);
    }

    Ok(())
}
