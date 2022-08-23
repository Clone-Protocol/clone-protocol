use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::WithdrawLiquidity;

pub fn execute(
    ctx: Context<WithdrawLiquidity>,
    manager_nonce: u8,
    liquidity_position_index: u8,
    liquidity_token_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
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

    // calculate the amount of iasset and usdi that the user can withdraw
    let (mut iasset_value, mut usdi_value) =
        calculate_liquidity_provider_values_from_liquidity_tokens(
            liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    iasset_value.rescale(DEVNET_TOKEN_SCALE);
    usdi_value.rescale(DEVNET_TOKEN_SCALE);

    // burn user liquidity tokens
    let cpi_ctx = CpiContext::from(&*ctx.accounts);
    token::burn(cpi_ctx, liquidity_token_amount)?;

    // transfer usdi to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let send_usdi_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_usdi_to_user_context,
        usdi_value.mantissa().try_into().unwrap(),
    )?;

    // transfer iasset to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_iasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let send_iasset_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_iasset_to_user_context,
        iasset_value.mantissa().try_into().unwrap(),
    )?;

    // update liquidity position data
    let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
    let liquidity_position =
        liquidity_positions.liquidity_positions[liquidity_position_index as usize];
    liquidity_positions.liquidity_positions[liquidity_position_index as usize]
        .liquidity_token_value = RawDecimal::from(
        liquidity_position.liquidity_token_value.to_decimal() - liquidity_token_value,
    );

    if liquidity_positions.liquidity_positions[liquidity_position_index as usize]
        .liquidity_token_value
        .to_decimal()
        .mantissa()
        == 0
    {
        // remove liquidity position from user list
        liquidity_positions.remove(liquidity_position_index as usize);
    }

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[liquidity_position.pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[liquidity_position.pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[liquidity_position.pool_index as usize].liquidity_token_supply =
        RawDecimal::new(
            ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

    Ok(())
}
