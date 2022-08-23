use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::InitializeLiquidityPosition;

pub fn execute(
    ctx: Context<InitializeLiquidityPosition>,
    manager_nonce: u8,
    pool_index: u8,
    iasset_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let iasset_liquidity_value =
        Decimal::new(iasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
    let iasset_amm_value = Decimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let usdi_amm_value = Decimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let liquidity_token_supply = Decimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    // calculate amount of usdi required as well as amount of liquidity tokens to be received
    let (mut usdi_liquidity_value, mut liquidity_token_value) =
        calculate_liquidity_provider_values_from_iasset(
            iasset_liquidity_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    // check to see if the pool is currently empty
    if iasset_amm_value.is_zero() && usdi_amm_value.is_zero() {
        let price = token_data.pools[pool_index as usize]
            .asset_info
            .price
            .to_decimal();
        usdi_liquidity_value *= price;
        liquidity_token_value *= price;
    }

    // transfer iasset from user to amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .amm_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let send_iasset_to_amm_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::transfer(send_iasset_to_amm_context, iasset_amount)?;

    // transfer usdi from user to amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_usdi_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let send_usdi_to_amm_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );
    usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);

    token::transfer(
        send_usdi_to_amm_context,
        usdi_liquidity_value.mantissa().try_into().unwrap(),
    )?;

    liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

    // mint liquidity tokens to user
    let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
    token::mint_to(
        cpi_ctx,
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

    // set liquidity position data
    let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
    let num_positions = liquidity_positions.num_positions;
    liquidity_positions.liquidity_positions[num_positions as usize] = LiquidityPosition {
        authority: *ctx.accounts.user.to_account_info().key,
        liquidity_token_value: RawDecimal::from(liquidity_token_value),
        pool_index: pool_index.try_into().unwrap(),
    };
    liquidity_positions.num_positions += 1;

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
