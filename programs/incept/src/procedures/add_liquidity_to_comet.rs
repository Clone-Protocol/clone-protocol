use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::AddLiquidityToComet;

pub fn execute(
    ctx: Context<AddLiquidityToComet>,
    manager_nonce: u8,
    pool_index: u8,
    usdi_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let usdi_liquidity_value = Decimal::new(usdi_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

    // calculate iasset liquidity value as well as liquidity token value for comet
    let (mut iasset_liquidity_value, mut liquidity_token_value) =
        calculate_liquidity_provider_values_from_usdi(
            usdi_liquidity_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    // find the index of the position within the comet position
    let comet_position_index = comet.get_pool_index(pool_index);

    // check to see if a new position must be added to the position
    if comet_position_index == usize::MAX {
        if comet.is_single_pool == 1 {
            return Err(InceptError::AttemptedToAddNewPoolToSingleComet.into());
        }

        iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

        comet.add_position(CometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            pool_index: pool_index as u64,
            borrowed_usdi: RawDecimal::from(usdi_liquidity_value),
            borrowed_iasset: RawDecimal::from(iasset_liquidity_value),
            liquidity_token_value: RawDecimal::from(liquidity_token_value),
            comet_liquidation: CometLiquidation {
                ..Default::default()
            },
        });
    } else {
        let position = comet.positions[comet_position_index];
        // update comet position data
        let mut borrowed_usdi = position.borrowed_usdi.to_decimal() + usdi_liquidity_value;
        borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

        let mut borrowed_iasset = position.borrowed_iasset.to_decimal() + iasset_liquidity_value;
        borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

        liquidity_token_value += position.liquidity_token_value.to_decimal();
        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

        comet.positions[comet_position_index].borrowed_usdi = RawDecimal::from(borrowed_usdi);
        comet.positions[comet_position_index].borrowed_iasset = RawDecimal::from(borrowed_iasset);
        comet.positions[comet_position_index].liquidity_token_value =
            RawDecimal::from(liquidity_token_value);
    }

    iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
    liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

    // mint liquidity into amm
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
    token::mint_to(mint_usdi_context, usdi_amount)?;
    let cpi_accounts = MintTo {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .amm_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let mint_iasset_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    token::mint_to(
        mint_iasset_context,
        iasset_liquidity_value.mantissa().try_into().unwrap(),
    )?;

    // mint liquidity tokens to comet
    let cpi_accounts = MintTo {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .comet_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let mint_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::mint_to(
        mint_liquidity_tokens_to_comet_context,
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

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

    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, token_data)?;

    require!(
        matches!(health_score, HealthScore::Healthy { .. }),
        InceptError::HealthScoreTooLow
    );

    Ok(())
}
