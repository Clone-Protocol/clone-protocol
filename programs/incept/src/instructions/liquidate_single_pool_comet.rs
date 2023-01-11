use crate::error::*;
use crate::math::*;
use crate::recenter_comet::{recenter_calculation, RecenterResult};
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user_nonce: u8, position_index: u8)]
pub struct LiquidateSinglePoolComet<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager.bump,
        has_one = token_data
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
        has_one = comet,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        constraint = comet.load()?.is_single_pool == 1,
        constraint = comet.load()?.owner == user_account.authority @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > position_index.into() @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = token_data.load()?.collaterals[comet.load()?.collaterals[position_index as usize].collateral_index as usize].mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[position_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn calculate_claims(
    comet_position: &CometPosition,
    comet_collateral: &CometCollateral,
    pool: &Pool,
    recenter_result: &RecenterResult,
    liquidation_config: &LiquidationConfig,
) -> Result<(Decimal, Decimal)> {
    let comet_lp_tokens = comet_position.liquidity_token_value.to_decimal();

    // After recenter, ILD should be zero or very near zero.
    // Assume we can ignore its impact on the health score.
    let min_collateral_claim = liquidation_config
        .collateral_full_liquidation_threshold
        .to_decimal();
    let claimable_fee = liquidation_config.liquidator_fee.to_decimal();
    let collateral_after_recenter = comet_collateral.collateral_amount.to_decimal()
        - recenter_result.user_usdi_collateral_deficit;
    let health_after_recenter = Decimal::new(100, 0)
        - pool.asset_info.health_score_coefficient.to_decimal()
            * recenter_result.user_borrowed_usdi
            / collateral_after_recenter;

    let max_health_liquidation = liquidation_config.max_health_liquidation.to_decimal();
    let health_score_delta = max_health_liquidation - health_after_recenter;

    let full_liquidation = min_collateral_claim >= collateral_after_recenter;
    let mut collateral_claim = min_collateral_claim.max(collateral_after_recenter * claimable_fee);

    let mut lp_to_claim = if full_liquidation {
        collateral_claim = collateral_after_recenter;
        comet_lp_tokens
    } else {
        let new_collateral_amount = collateral_after_recenter - collateral_claim;
        let new_usdi_position = new_collateral_amount
            * (recenter_result.user_borrowed_usdi / collateral_after_recenter
                - health_score_delta / pool.asset_info.health_score_coefficient.to_decimal());
        let target_usdi_position_change = recenter_result.user_borrowed_usdi - new_usdi_position;

        (comet_lp_tokens * target_usdi_position_change / recenter_result.user_borrowed_usdi)
            .min(comet_lp_tokens)
    };
    lp_to_claim.rescale(DEVNET_TOKEN_SCALE);
    collateral_claim.rescale(DEVNET_TOKEN_SCALE);

    Ok((lp_to_claim, collateral_claim))
}

pub fn execute(
    ctx: Context<LiquidateSinglePoolComet>,
    _user_nonce: u8,
    position_index: u8,
) -> Result<()> {
    let manager_nonce = ctx.accounts.manager.bump;
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let pool_index = comet.positions[position_index as usize].pool_index as usize;
    let pool = token_data.pools[pool_index];

    let comet_collateral = comet.collaterals[position_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    let comet_position = comet.positions[position_index as usize];

    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, &token_data, Some(pool_index))?;

    require!(
        !health_score.is_healthy(),
        InceptError::NotSubjectToLiquidation
    );

    require!(collateral.stable == 1, InceptError::InvalidCollateralType);

    // Recenter comet calculation
    let recenter_result = recenter_calculation(
        &comet,
        &token_data,
        position_index as usize,
        position_index as usize,
    )?;

    let (lp_to_claim, collateral_claim) = calculate_claims(
        &comet_position,
        &comet_collateral,
        &pool,
        &recenter_result,
        &ctx.accounts.manager.liquidation_config,
    )?;
    let comet_lp_tokens = comet_position.liquidity_token_value.to_decimal();

    let mut usdi_claimed = recenter_result.user_borrowed_usdi * lp_to_claim / comet_lp_tokens;
    usdi_claimed.rescale(DEVNET_TOKEN_SCALE);
    let mut iasset_claimed = recenter_result.user_borrowed_iasset * lp_to_claim / comet_lp_tokens;
    iasset_claimed.rescale(DEVNET_TOKEN_SCALE);

    // Adjust comet position values
    comet.positions[position_index as usize].borrowed_usdi =
        RawDecimal::from(recenter_result.user_borrowed_usdi - usdi_claimed);
    comet.positions[position_index as usize].borrowed_iasset =
        RawDecimal::from(recenter_result.user_borrowed_iasset - iasset_claimed);
    comet.positions[position_index as usize].liquidity_token_value =
        RawDecimal::from(comet_lp_tokens - lp_to_claim);
    // Adjust collateral values
    let new_collateral_deficit = recenter_result.user_usdi_collateral_deficit + collateral_claim;
    comet.collaterals[position_index as usize].collateral_amount = RawDecimal::from(
        comet.collaterals[position_index as usize]
            .collateral_amount
            .to_decimal()
            - new_collateral_deficit,
    );

    let using_usdi_collateral = comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX;
    // Transfer collateral between vault and amm
    if recenter_result
        .user_usdi_collateral_deficit
        .is_sign_positive()
    {
        // If collateral is USDi Transfer from vault to amm.
        // Else mint usdi into amm.
        if using_usdi_collateral {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info().clone(),
                        to: ctx
                            .accounts
                            .amm_usdi_token_account
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                recenter_result
                    .user_usdi_collateral_deficit
                    .mantissa()
                    .try_into()
                    .unwrap(),
            )?;
        } else {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    MintTo {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        to: ctx
                            .accounts
                            .amm_usdi_token_account
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                recenter_result
                    .user_usdi_collateral_deficit
                    .mantissa()
                    .try_into()
                    .unwrap(),
            )?;
        }
    } else if recenter_result
        .user_usdi_collateral_deficit
        .is_sign_negative()
    {
        // If collateral is USDi transfer from amm to vault
        // Else burn usdi in amm.
        if using_usdi_collateral {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Transfer {
                        to: ctx.accounts.vault.to_account_info().clone(),
                        from: ctx
                            .accounts
                            .amm_usdi_token_account
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                recenter_result
                    .user_usdi_collateral_deficit
                    .abs()
                    .mantissa()
                    .try_into()
                    .unwrap(),
            )?;
        } else {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        from: ctx
                            .accounts
                            .amm_usdi_token_account
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                recenter_result
                    .user_usdi_collateral_deficit
                    .abs()
                    .mantissa()
                    .try_into()
                    .unwrap(),
            )?;
        }
    }
    // Transfer fee from vault to liquidator
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                to: ctx
                    .accounts
                    .liquidator_collateral_token_account
                    .to_account_info()
                    .clone(),
                from: ctx.accounts.vault.to_account_info().clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            },
            seeds,
        ),
        collateral_claim.mantissa().try_into().unwrap(),
    )?;

    // adjust amm values by burn/minting correct amounts.
    let mut amm_burn_usdi = recenter_result.amm_usdi_burn + usdi_claimed;
    amm_burn_usdi.rescale(DEVNET_TOKEN_SCALE);
    let mut amm_burn_iasset = recenter_result.amm_iasset_burn + iasset_claimed;
    amm_burn_iasset.rescale(DEVNET_TOKEN_SCALE);

    // Burn or mint for amm
    if amm_burn_usdi.is_sign_positive() {
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .amm_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            recenter_result.amm_usdi_burn.mantissa().try_into().unwrap(),
        )?;
    } else if amm_burn_usdi.is_sign_negative() {
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            recenter_result
                .amm_usdi_burn
                .abs()
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    }

    if amm_burn_iasset.is_sign_positive() {
        token::burn(
            CpiContext::new_with_signer(
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
            ),
            recenter_result
                .amm_iasset_burn
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    } else if amm_burn_iasset.is_sign_negative() {
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            recenter_result
                .amm_iasset_burn
                .abs()
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    }
    // Burn lp tokens
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
        lp_to_claim.mantissa().try_into().unwrap(),
    )?;

    // Update token data
    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.vault.reload()?;

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
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::new(
            ctx.accounts.vault.amount.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

    Ok(())
}
