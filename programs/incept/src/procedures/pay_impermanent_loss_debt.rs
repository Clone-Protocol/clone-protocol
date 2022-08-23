use crate::error::*;
use crate::instructions::PayImpermanentLossDebt;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo};
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub fn execute(
    ctx: Context<PayImpermanentLossDebt>,
    manager_nonce: u8,
    comet_position_index: u8,
    comet_collateral_index: u8,
    collateral_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_position = comet.positions[comet_position_index as usize];
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];
    let pool = token_data.pools[comet_position.pool_index as usize];

    let mut collateral_reduction_value =
        Decimal::new(collateral_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

    let pool_usdi = pool.usdi_amount.to_decimal();
    let pool_iasset = pool.iasset_amount.to_decimal();

    if borrowed_usdi.is_zero() && borrowed_iasset.is_zero() {
        // if there is no debt, close the position
        // TODO: Do we also need to close out the account for a single pool?
        comet.remove_position(comet_position_index.into());
        return Ok(());
    } else if borrowed_iasset.is_zero() {
        // if usdi, update collateral and reduce borrowed amount
        collateral_reduction_value = collateral_reduction_value.min(borrowed_usdi);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(borrowed_usdi - collateral_reduction_value);
    } else if borrowed_usdi.is_zero() {
        // if iAsset, calculate iAsset from usdi amount, mint usdi to amm, burn iAsset amount from pool.
        let invariant = calculate_invariant(pool_iasset, pool_usdi);
        let new_usdi_pool_amount = pool_usdi + collateral_reduction_value;
        let mut iasset_reduction_value = pool_iasset - invariant / new_usdi_pool_amount;

        // update reduction values if they are too large
        if iasset_reduction_value > borrowed_iasset {
            let new_iasset_pool_amount = pool_iasset - borrowed_iasset;
            collateral_reduction_value = pool_usdi - invariant / new_iasset_pool_amount;
            iasset_reduction_value = borrowed_iasset;
        }

        let mut new_borrowed_iasset = borrowed_iasset - iasset_reduction_value;
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);

        // mint usdi and burn iasset from the pool
        let cpi_accounts = MintTo {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::mint_to(mint_usdi_context, collateral_amount)?;
        let cpi_accounts = Burn {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        iasset_reduction_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_reduction_value.mantissa().try_into().unwrap(),
        )?;
    } else {
        return Err(InceptError::LiquidityNotWithdrawn.into());
    }

    if comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX {
        // burn usdi from vault
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx.accounts.vault.to_account_info().clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        collateral_reduction_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_usdi_context,
            collateral_reduction_value.mantissa().try_into().unwrap(),
        )?;
    } else {
        // add to the amount of collateral backing usdi
        let mut vault_usdi_supply =
            collateral.vault_usdi_supply.to_decimal() + collateral_reduction_value;
        vault_usdi_supply.rescale(DEVNET_TOKEN_SCALE);
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
            RawDecimal::from(vault_usdi_supply);
    }

    // subtract the collateral the user paid from the position and subtract from the debt
    let collateral_scale = token_data.collaterals[comet_collateral.collateral_index as usize]
        .vault_comet_supply
        .to_decimal()
        .scale();
    let mut vault_comet_supply =
        collateral.vault_comet_supply.to_decimal() - collateral_reduction_value;
    vault_comet_supply.rescale(collateral_scale);
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::from(vault_comet_supply);

    let mut comet_collateral =
        comet_collateral.collateral_amount.to_decimal() - collateral_reduction_value;
    comet_collateral.rescale(collateral_scale);

    comet.collaterals[comet_collateral_index as usize].collateral_amount =
        RawDecimal::from(comet_collateral);
    if comet.positions[comet_position_index as usize]
        .borrowed_iasset
        .to_decimal()
        .is_zero()
        && comet.positions[comet_position_index as usize]
            .borrowed_usdi
            .to_decimal()
            .is_zero()
    {
        // if there is no debt, close the position
        comet.remove_position(comet_position_index.into());
    }

    // Update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;

    token_data.pools[comet_position.pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[comet_position.pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
