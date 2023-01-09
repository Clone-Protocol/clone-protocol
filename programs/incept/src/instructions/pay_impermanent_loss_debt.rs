use crate::error::*;
//use crate::instructions::PayImpermanentLossDebt;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, comet_position_index: u8, comet_collateral_index: u8, collateral_amount: u64)]
pub struct PayImpermanentLossDebt<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.load()?.owner == user.key() @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
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
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
        constraint = &vault.mint == &token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].mint
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

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

    if comet.is_single_pool == 1 {
        require!(
            comet_position_index == comet_collateral_index,
            InceptError::InvalidInputPositionIndex
        );
    }

    let comet_position = comet.positions[comet_position_index as usize];
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    require!(collateral.stable == 1, InceptError::NonStablesNotSupported);

    let pool = token_data.pools[comet_position.pool_index as usize];

    let mut collateral_reduction_value =
        Decimal::new(collateral_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE)
            .min(comet_collateral.collateral_amount.to_decimal());

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

    let pool_usdi = pool.usdi_amount.to_decimal();
    let pool_iasset = pool.iasset_amount.to_decimal();

    if borrowed_usdi.is_zero() && borrowed_iasset.is_zero() {
        // if there is no debt, close the position
        // TODO: Do we also need to close out the account for a single pool?
        if comet.is_single_pool != 1 {
            comet.remove_position(comet_position_index.into());
        }
        return Ok(());
    } else if borrowed_iasset > Decimal::ZERO {
        // if iAsset, calculate iAsset from usdi amount, mint usdi to amm, burn iAsset amount from pool.
        let invariant = calculate_invariant(pool_iasset, pool_usdi);
        let new_usdi_pool_amount = pool_usdi + collateral_reduction_value;
        let mut iasset_reduction_value = pool_iasset - invariant / new_usdi_pool_amount;

        // update reduction values if they are too large
        if iasset_reduction_value > borrowed_iasset {
            let new_iasset_pool_amount = pool_iasset - borrowed_iasset;
            collateral_reduction_value = invariant / new_iasset_pool_amount - pool_usdi;
            iasset_reduction_value = borrowed_iasset;
        }
        assert!(collateral_reduction_value > Decimal::ZERO);
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
        collateral_reduction_value.rescale(DEVNET_TOKEN_SCALE);
        token::mint_to(
            mint_usdi_context,
            collateral_reduction_value.mantissa().try_into().unwrap(),
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
        iasset_reduction_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_reduction_value.mantissa().try_into().unwrap(),
        )?;
    } else if borrowed_usdi > Decimal::ZERO {
        // if usdi, update collateral and reduce borrowed amount
        collateral_reduction_value = collateral_reduction_value.min(borrowed_usdi);
        let mut new_borrowed_usdi = borrowed_usdi - collateral_reduction_value;
        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);
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
        let current_vault_usdi_supply = collateral.vault_usdi_supply.to_decimal();
        let mut vault_usdi_supply = current_vault_usdi_supply + collateral_reduction_value;
        vault_usdi_supply.rescale(current_vault_usdi_supply.scale());
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
        && comet.is_single_pool != 1
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
