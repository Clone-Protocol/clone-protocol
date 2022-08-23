use crate::error::*;
use crate::instructions::LiquidateMintPosition;
use crate::math::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Transfer};
use std::convert::TryInto;

pub fn execute(
    ctx: Context<LiquidateMintPosition>,
    manager_nonce: u8,
    mint_index: u8,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let token_data = &mut ctx.accounts.token_data.load()?;
    let mint_positions = ctx.accounts.mint_positions.load_mut()?;
    let mint_position = mint_positions.mint_positions[mint_index as usize];

    let collateral = token_data.collaterals[mint_position.collateral_index as usize];
    let pool = token_data.pools[mint_position.pool_index as usize];
    // Check if this position is valid for liquidation
    if collateral.stable == 0 {
        return Err(InceptError::NonStablesNotSupported.into());
    }

    // ensure price data is up to date
    let slot = Clock::get()?.slot;
    check_feed_update(pool.asset_info, slot).unwrap();

    let borrowed_iasset = mint_position.borrowed_iasset.to_decimal();
    let collateral_amount_value = mint_position.collateral_amount.to_decimal();

    // Should fail here.
    if check_mint_collateral_sufficient(
        pool.asset_info,
        borrowed_iasset,
        pool.asset_info.stable_collateral_ratio.to_decimal(),
        collateral_amount_value,
        slot,
    )
    .is_ok()
    {
        return Err(InceptError::MintPositionUnableToLiquidate.into());
    }

    // Burn the iAsset from the liquidator
    let cpi_accounts = Burn {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .liquidator_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.liquidator.to_account_info().clone(),
    };
    let burn_liquidator_iasset_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::burn(
        burn_liquidator_iasset_context,
        mint_position
            .borrowed_iasset
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
    )?;

    // Send the user the remaining collateral.
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .liquidator_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let send_usdc_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_usdc_context,
        mint_position
            .collateral_amount
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
    )?;

    Ok(())
}
