use crate::error::*;
use crate::instructions::WithdrawLiquidityFromComet;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub fn execute(
    ctx: Context<WithdrawLiquidityFromComet>,
    manager_nonce: u8,
    comet_position_index: u8,
    liquidity_token_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_position = comet.positions[comet_position_index as usize];
    let usdi_collateral = token_data.collaterals[0];
    let mut usdi_comet_collateral_index = comet.get_collateral_index(0);
    if usdi_comet_collateral_index == usize::MAX {
        usdi_comet_collateral_index = comet.num_collaterals as usize;
        comet.add_collateral(CometCollateral {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: RawDecimal::default(),
            collateral_index: 0,
        })
    }
    let usdi_comet_collateral = comet.collaterals[usdi_comet_collateral_index];

    let mut liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    require!(
        liquidity_token_value <= comet_position.liquidity_token_value.to_decimal(),
        InceptError::InvalidTokenAccountBalance
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

    // calculate iasset liquidity value as well as liquidity token value for comet
    let (mut iasset_liquidity_value, mut usdi_liquidity_value) =
        calculate_liquidity_provider_values_from_liquidity_tokens(
            liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    let lp_position_claimable_ratio =
        liquidity_token_value / comet_position.liquidity_token_value.to_decimal();

    // calculate initial comet pool price
    let initial_comet_price = calculate_amm_price(
        comet_position.borrowed_iasset.to_decimal(),
        comet_position.borrowed_usdi.to_decimal(),
    );
    // calculate current pool price
    let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);
    // check if price has decreased since comet was initialized
    if initial_comet_price > current_price {
        // IL is in USDi, reward in iasset
        let mut iasset_burn_value =
            lp_position_claimable_ratio * comet_position.borrowed_iasset.to_decimal();
        iasset_burn_value = if iasset_burn_value > iasset_liquidity_value {
            iasset_liquidity_value
        } else {
            iasset_burn_value
        };

        let mut iasset_surplus = iasset_liquidity_value - iasset_burn_value;

        // burn liquidity from amm
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_usdi_context,
            usdi_liquidity_value.mantissa().try_into().unwrap(),
        )?;
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
        iasset_burn_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_burn_value.mantissa().try_into().unwrap(),
        )?;

        // calculate usdi collateral amount to add
        let invariant_after_withdrawl =
            (iasset_amm_value - iasset_liquidity_value) * (usdi_amm_value - usdi_liquidity_value);
        let usdi_collateral_amount = (usdi_amm_value - usdi_liquidity_value)
            - (invariant_after_withdrawl / (iasset_amm_value - iasset_burn_value));

        // transfer usdi to vault
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx.accounts.vault.to_account_info().clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let transfer_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        iasset_surplus.rescale(DEVNET_TOKEN_SCALE);
        token::transfer(
            transfer_iasset_context,
            usdi_collateral_amount.mantissa().try_into().unwrap(),
        )?;

        let mut borrowed_usdi = comet_position.borrowed_usdi.to_decimal() - usdi_liquidity_value;
        borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        let mut borrowed_iasset = comet_position.borrowed_iasset.to_decimal() - iasset_burn_value;
        borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

        // update comet data
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(borrowed_usdi);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(borrowed_iasset);
        token_data.collaterals[0].vault_comet_supply = RawDecimal::from(
            usdi_collateral.vault_comet_supply.to_decimal() + usdi_collateral_amount,
        );
        comet.collaterals[usdi_comet_collateral_index].collateral_amount = RawDecimal::from(
            usdi_comet_collateral.collateral_amount.to_decimal() + usdi_collateral_amount,
        );
    } else if initial_comet_price < current_price {
        let mut usdi_burn_value =
            lp_position_claimable_ratio * comet_position.borrowed_usdi.to_decimal();
        usdi_burn_value = if usdi_burn_value > usdi_liquidity_value {
            usdi_liquidity_value
        } else {
            usdi_burn_value
        };
        let mut usdi_surplus = usdi_liquidity_value - usdi_burn_value;
        // burn liquidity from amm
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        usdi_burn_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_usdi_context,
            usdi_burn_value.mantissa().try_into().unwrap(),
        )?;
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
        iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_liquidity_value.mantissa().try_into().unwrap(),
        )?;

        // transfer usdi to vault
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx.accounts.vault.to_account_info().clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let transfer_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        usdi_surplus.rescale(DEVNET_TOKEN_SCALE);
        token::transfer(
            transfer_iasset_context,
            usdi_surplus.mantissa().try_into().unwrap(),
        )?;
        // update comet data
        let mut borrowed_usdi = comet_position.borrowed_usdi.to_decimal() - usdi_burn_value;
        borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        let mut borrowed_iasset =
            comet_position.borrowed_iasset.to_decimal() - iasset_liquidity_value;
        borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(borrowed_usdi);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(borrowed_iasset);
        token_data.collaterals[0].vault_comet_supply =
            RawDecimal::from(usdi_collateral.vault_comet_supply.to_decimal() + usdi_surplus);
        comet.collaterals[usdi_comet_collateral_index].collateral_amount =
            RawDecimal::from(usdi_comet_collateral.collateral_amount.to_decimal() + usdi_surplus);
    } else {
        // burn liquidity from amm
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_usdi_context,
            usdi_liquidity_value.mantissa().try_into().unwrap(),
        )?;
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
        iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_liquidity_value.mantissa().try_into().unwrap(),
        )?;

        let mut borrowed_usdi = comet_position.borrowed_usdi.to_decimal() - usdi_liquidity_value;
        borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

        let mut borrowed_iasset =
            comet_position.borrowed_iasset.to_decimal() - iasset_liquidity_value;
        borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(borrowed_usdi);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(borrowed_iasset);
    }
    // burn liquidity tokens from comet
    let cpi_accounts = Burn {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .comet_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let burn_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
    token::burn(
        burn_liquidity_tokens_to_comet_context,
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

    // update comet position data
    let mut updated_liquidity_token_value =
        comet_position.liquidity_token_value.to_decimal() - liquidity_token_value;
    updated_liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
    comet.positions[comet_position_index as usize].liquidity_token_value =
        RawDecimal::from(updated_liquidity_token_value);

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

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
    token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
