use crate::error::*;
//use crate::instructions::RecenterComet;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, comet_position_index: u8, comet_collateral_index: u8)]
pub struct RecenterComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = &comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (comet_position_index as u64) < comet.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account

    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
        constraint = &vault.mint == &token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].mint
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<RecenterComet>,
    manager_nonce: u8,
    comet_position_index: u8,
    comet_collateral_index: u8,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_position = comet.positions[comet_position_index as usize];
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    // check to see if the collateral used to mint usdi is stable
    let is_stable: Result<bool> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(InceptError::InvalidBool)),
    };

    // if collateral is not stable, we throw an error
    if !(is_stable.unwrap()) {
        return Err(InceptError::InvalidCollateralType.into());
    }

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

    // calculate usdi and iasset comet can claim right now
    let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
        comet_position.liquidity_token_value.to_decimal(),
        iasset_amm_value,
        usdi_amm_value,
        liquidity_token_supply,
    )?;

    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();
    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();

    // check if the price has moved significantly
    if (iasset_value < borrowed_iasset && usdi_value < borrowed_usdi)
        || (iasset_value > borrowed_iasset && usdi_value > borrowed_usdi)
    {
        // price has NOT moved significantly throw error
        return Err(InceptError::NoPriceDeviationDetected.into());
    }

    // calculate initial comet pool price
    let initial_comet_price = calculate_amm_price(borrowed_iasset, borrowed_usdi);
    // calculate current pool price
    let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

    // check if price has increased since comet was initialized
    if initial_comet_price < current_price {
        // calculate extra usdi comet can claim, iasset debt that comet cannot claim, and usdi amount needed to buy iasset and cover debt
        let (usdi_surplus, mut usdi_amount, mut iasset_debt) =
            calculate_recentering_values_with_usdi_surplus(
                borrowed_iasset,
                borrowed_usdi,
                iasset_amm_value,
                usdi_amm_value,
                comet_position.liquidity_token_value.to_decimal(),
                liquidity_token_supply,
            );

        // calculate the amount of additional usdi, otherwise known as the recentering fee, in order to recenter the position
        let mut recentering_fee = usdi_amount - usdi_surplus;
        assert!(!recentering_fee.is_sign_negative());
        recentering_fee.rescale(DEVNET_TOKEN_SCALE);

        let mut recentering_fee_collateral_scale = recentering_fee;
        recentering_fee_collateral_scale
            .rescale(comet_collateral.collateral_amount.to_decimal().scale());

        // recalculate amount of iasset the comet has borrowed
        let mut new_borrowed_iasset = borrowed_iasset - iasset_debt;

        // recalculate amount of usdi the comet has borrowed
        let mut new_borrowed_usdi = borrowed_usdi + usdi_surplus;

        // update comet data
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);

        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);

        if comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX {
            // burn usdi from vault
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                from: ctx.accounts.vault.to_account_info().clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_usdi_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(
                burn_usdi_context,
                recentering_fee.mantissa().try_into().unwrap(),
            )?;
        } else {
            let mut vault_usdi_supply =
                collateral.vault_usdi_supply.to_decimal() + recentering_fee_collateral_scale;
            vault_usdi_supply.rescale(DEVNET_TOKEN_SCALE);
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
                RawDecimal::from(vault_usdi_supply);
        }

        // subtract the collateral the user paid from the position
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            RawDecimal::from(
                collateral.vault_comet_supply.to_decimal() - recentering_fee_collateral_scale,
            );
        comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
            comet_collateral.collateral_amount.to_decimal() - recentering_fee_collateral_scale,
        );

        // mint usdi into amm
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
        usdi_amount.rescale(DEVNET_TOKEN_SCALE);
        token::mint_to(
            mint_usdi_context,
            usdi_amount.mantissa().try_into().unwrap(),
        )?;

        // burn iasset from amm
        let cpi_accounts = Burn {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            from: ctx
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
        iasset_debt.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_debt.mantissa().try_into().unwrap(),
        )?;
    } else if initial_comet_price > current_price {
        // calculate extra iasset comet can claim, usdi debt that comet cannot claim, and iasset amount needed to buy usdi and cover debt
        let (mut iasset_surplus, mut usdi_burned, usdi_debt) =
            calculate_recentering_values_with_iasset_surplus(
                borrowed_iasset,
                borrowed_usdi,
                iasset_amm_value,
                usdi_amm_value,
                comet_position.liquidity_token_value.to_decimal(),
                liquidity_token_supply,
            );

        // calculate the amount of additional iassset, otherwise known as the recentering fee, in order to recenter the position
        let mut recentering_fee = usdi_debt - usdi_burned;

        assert!(!recentering_fee.is_sign_negative());

        let mut recentering_fee_collateral_scale = recentering_fee;
        recentering_fee_collateral_scale
            .rescale(comet_collateral.collateral_amount.to_decimal().scale());
        // recalculate amount of iasset the comet has borrowed
        let mut new_borrowed_iasset = borrowed_iasset + iasset_surplus;

        // recalculate amount of usdi the comet has borrowed
        let mut new_borrowed_usdi = borrowed_usdi - usdi_debt;

        // update comet data
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);

        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);

        if comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX {
            // burn usdi from vault
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                from: ctx.accounts.vault.to_account_info().clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_usdi_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            recentering_fee.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_usdi_context,
                recentering_fee.mantissa().try_into().unwrap(),
            )?;
        } else {
            let vault_usdi_supply =
                collateral.vault_usdi_supply.to_decimal() - recentering_fee_collateral_scale;
            // add to the amount of collateral backing usdi
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
                RawDecimal::from(vault_usdi_supply);
        }

        let mut vault_comet_supply = collateral.vault_comet_supply.to_decimal() - recentering_fee;
        vault_comet_supply.rescale(DEVNET_TOKEN_SCALE);
        // subtract the collateral the user paid from the position
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            RawDecimal::from(vault_comet_supply);

        let collateral_amount =
            comet_collateral.collateral_amount.to_decimal() - recentering_fee_collateral_scale;
        comet.collaterals[comet_collateral_index as usize].collateral_amount =
            RawDecimal::from(collateral_amount);

        // mint iasset into amm
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
        iasset_surplus.rescale(DEVNET_TOKEN_SCALE);
        token::mint_to(
            mint_iasset_context,
            iasset_surplus.mantissa().try_into().unwrap(),
        )?;

        // burn usdi from amm
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            from: ctx
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
        usdi_burned.rescale(DEVNET_TOKEN_SCALE);

        token::burn(
            burn_usdi_context,
            usdi_burned.mantissa().try_into().unwrap(),
        )?;
    } else {
        return Err(InceptError::NoPriceDeviationDetected.into());
    }

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
