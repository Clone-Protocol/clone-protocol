use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::SellSynth;

pub fn execute(
    ctx: Context<SellSynth>,
    manager_nonce: u8,
    pool_index: u8,
    amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];

    let iasset_amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

    // calculate how much usdi will be recieved
    let mut usdi_amount_value =
        calculate_price_from_iasset(iasset_amount_value, iasset_amm_value, usdi_amm_value, false)?
            * (Decimal::ONE - pool.liquidity_trading_fee.to_decimal());

    usdi_amount_value.rescale(DEVNET_TOKEN_SCALE);

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

    token::transfer(send_iasset_to_amm_context, amount)?;

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
        usdi_amount_value.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
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

    Ok(())
}
