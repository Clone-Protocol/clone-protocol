use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::AddiAssetToMint;

pub fn execute(
    ctx: Context<AddiAssetToMint>,
    manager_nonce: u8,
    mint_index: u8,
    amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let token_data = ctx.accounts.token_data.load_mut()?;
    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

    let amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let pool_index = mint_positions.mint_positions[mint_index as usize].pool_index;
    let pool = token_data.pools[pool_index as usize];
    let mint_position = mint_positions.mint_positions[mint_index as usize];
    let collateral_ratio = pool.asset_info.stable_collateral_ratio.to_decimal();

    // update total amount of borrowed iasset
    mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
        RawDecimal::from(mint_position.borrowed_iasset.to_decimal() + amount_value);

    let slot = Clock::get()?.slot;

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool.asset_info,
        mint_positions.mint_positions[mint_index as usize]
            .borrowed_iasset
            .to_decimal(),
        collateral_ratio,
        mint_position.collateral_amount.to_decimal(),
        slot,
    )
    .unwrap();

    // mint iasset to the user
    let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
    token::mint_to(cpi_ctx, amount)?;

    Ok(())
}
