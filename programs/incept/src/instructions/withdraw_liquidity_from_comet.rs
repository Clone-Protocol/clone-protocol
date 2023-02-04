use crate::error::*;
//use crate::instructions::WithdrawLiquidityFromComet;

use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, comet_position_index: u8, liquidity_token_amount: u64, comet_collateral_index: u8)]
pub struct WithdrawLiquidityFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (comet_position_index as u64) < comet.load()?.num_positions @ InceptError::InvalidInputPositionIndex
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
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].liquidity_token_mint,
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[0].vault,
        constraint = vault.mint == usdi_mint.key()
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromComet>,
    manager_nonce: u8,
    comet_position_index: u8,
    liquidity_token_amount: u64,
    _comet_collateral_index: u8,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_position = comet.positions[comet_position_index as usize];
    let comet_collateral = comet.collaterals[0];

    let comet_liquidity_tokens = comet_position.liquidity_token_value.to_decimal();

    require!(
        comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX,
        InceptError::InvalidCollateralType
    );

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    )
    .min(comet_liquidity_tokens);

    let _collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

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

    let lp_position_claimable_ratio = liquidity_token_value / liquidity_token_supply;

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

    let mut claimable_usdi = lp_position_claimable_ratio * usdi_amm_value;
    claimable_usdi.rescale(DEVNET_TOKEN_SCALE);
    let mut claimable_iasset = lp_position_claimable_ratio * iasset_amm_value;
    claimable_iasset.rescale(DEVNET_TOKEN_SCALE);

    let mut usdi_reward = Decimal::zero();
    let mut usdi_to_burn = Decimal::zero();
    let mut iasset_to_burn = Decimal::zero();

    if claimable_usdi > borrowed_usdi {
        usdi_to_burn += borrowed_usdi;
        // Claim USDi reward
        usdi_reward += claimable_usdi - borrowed_usdi;
        // Set borrowed USDi to zero.
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
    } else {
        usdi_to_burn += claimable_usdi;
        let mut new_borrowed_usdi = borrowed_usdi - claimable_usdi;
        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);
    }

    if claimable_iasset > borrowed_iasset {
        iasset_to_burn += borrowed_iasset;
        // Calculate iasset reward and its conversion to usdi.
        let iasset_reward = claimable_iasset - borrowed_iasset;

        let post_claim_usdi_amm = usdi_amm_value - claimable_usdi;
        let post_claim_iasset_amm = iasset_amm_value - claimable_iasset;
        let invariant = post_claim_usdi_amm * post_claim_iasset_amm;

        let mut usdi_traded_for =
            post_claim_usdi_amm - invariant / (post_claim_iasset_amm + iasset_reward);
        usdi_traded_for.rescale(DEVNET_TOKEN_SCALE);
        usdi_reward += usdi_traded_for;

        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
    } else {
        iasset_to_burn += claimable_iasset;
        let mut new_borrowed_iasset = borrowed_iasset - claimable_iasset;
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);
    }

    // Send usdi reward from amm to collateral vault
    if usdi_reward.is_sign_positive() {
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx.accounts.vault.to_account_info().clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let transfer_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        usdi_reward.rescale(DEVNET_TOKEN_SCALE);
        token::transfer(
            transfer_usdi_context,
            usdi_reward.mantissa().try_into().unwrap(),
        )?;

        let mut new_usdi_collateral = comet_collateral.collateral_amount.to_decimal() + usdi_reward;
        new_usdi_collateral.rescale(DEVNET_TOKEN_SCALE);
        comet.collaterals[comet_position_index as usize].collateral_amount =
            RawDecimal::from(new_usdi_collateral);
    }

    // Burn Usdi from amm
    if usdi_to_burn.is_sign_positive() {
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        usdi_to_burn.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            usdi_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn iasset from amm
    if iasset_to_burn.is_sign_positive() {
        let burn_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            },
            seeds,
        );
        iasset_to_burn.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            },
            seeds,
        ),
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

    // Remove lp tokens from user
    let mut new_comet_liquidity_tokens = comet_liquidity_tokens - liquidity_token_value;
    new_comet_liquidity_tokens.rescale(DEVNET_TOKEN_SCALE);
    comet.positions[comet_position_index as usize].liquidity_token_value =
        RawDecimal::from(new_comet_liquidity_tokens);

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
