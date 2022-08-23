use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::InitializeMintPosition;

pub fn execute(
    ctx: Context<InitializeMintPosition>,
    manager_nonce: u8,
    iasset_amount: u64,
    collateral_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let (collateral, collateral_index) =
        TokenData::get_collateral_tuple(&*token_data, *ctx.accounts.vault.to_account_info().key)
            .unwrap();

    let (pool, pool_index) = TokenData::get_pool_tuple_from_iasset_mint(
        &*token_data,
        *ctx.accounts.iasset_mint.to_account_info().key,
    )
    .unwrap();

    let collateral_amount_value = Decimal::new(
        collateral_amount.try_into().unwrap(),
        collateral
            .vault_mint_supply
            .to_decimal()
            .scale()
            .try_into()
            .unwrap(),
    );
    let iasset_amount_value = Decimal::new(iasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    // check to see if collateral is stable
    let is_stable: Result<bool, InceptError> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(InceptError::InvalidBool),
    };

    // if collateral is not stable, throw an error
    if !(is_stable.unwrap()) {
        return Err(InceptError::InvalidCollateralType.into());
    }
    let collateral_ratio = pool.asset_info.stable_collateral_ratio.to_decimal();

    // ensure position sufficiently over collateralized and oracle prices are up to date
    let slot = Clock::get()?.slot;
    check_mint_collateral_sufficient(
        pool.asset_info,
        iasset_amount_value,
        collateral_ratio,
        collateral_amount_value,
        slot,
    )?;

    // lock user collateral in vault
    let cpi_ctx_transfer: CpiContext<Transfer> = CpiContext::from(&*ctx.accounts);
    token::transfer(cpi_ctx_transfer, collateral_amount)?;

    // mint iasset to user
    let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
    token::mint_to(cpi_ctx_mint, iasset_amount)?;

    // set mint position data
    let mut mint_positions = ctx.accounts.mint_positions.load_mut()?;
    let num_positions = mint_positions.num_positions;
    mint_positions.mint_positions[num_positions as usize] = MintPosition {
        authority: *ctx.accounts.user.to_account_info().key,
        collateral_amount: RawDecimal::from(collateral_amount_value),
        collateral_index: collateral_index.try_into().unwrap(),
        pool_index: pool_index.try_into().unwrap(),
        borrowed_iasset: RawDecimal::from(iasset_amount_value),
    };

    // add collateral amount to vault supply
    token_data.collaterals[collateral_index].vault_mint_supply =
        RawDecimal::from(collateral.vault_mint_supply.to_decimal() + collateral_amount_value);

    // increment number of mint positions
    mint_positions.num_positions += 1;

    Ok(())
}
