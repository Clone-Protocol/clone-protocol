use crate::error::*;
use crate::math::*;
use crate::recenter_comet::{RecenterResult, recenter_calculation};
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::cmp::Ordering;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user_nonce: u8, position_index: u8)]
pub struct LiquidateComet<'info> {
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
    /// CHECK: Only used for address validation.
    #[account(
        address = user_account.authority
    )]
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
        has_one = comet,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
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
        associated_token::mint = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault,
   )]
    pub usdi_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

struct LiquidationResult {
    pub lp_tokens_to_withdraw: Decimal,
    pub reward_from_collateral: Decimal,
    pub recenter_result: RecenterResult,
}

fn calculate_liquidation_result(
    health_score: &HealthScore,
    comet: &Comet,
    token_data: &TokenData,
    liquidation_config: &LiquidationConfig,
    comet_position_index: usize,
    collateral_position_index: usize,
) -> Result<LiquidationResult> {
    let comet_position = comet.positions[comet_position_index];
    let comet_lp_tokens = comet_position.liquidity_token_value.to_decimal();
    let pool = token_data.pools[comet_position.pool_index as usize];
    let total_lp_tokens = pool.liquidity_token_supply.to_decimal();
    let claimable_ratio = comet_lp_tokens / total_lp_tokens;
    let comet_position_il = (comet_position.borrowed_usdi.to_decimal()
        - claimable_ratio * pool.usdi_amount.to_decimal())
    .max(Decimal::ZERO)
        + (comet_position.borrowed_iasset.to_decimal()
            - claimable_ratio * pool.iasset_amount.to_decimal())
        .max(Decimal::ZERO);
    let comet_position_il_term =
        comet_position_il * token_data.il_health_score_coefficient.to_decimal();

    // Take collateral reward
    let collateral =
        comet.calculate_effective_collateral_value(token_data, Some(collateral_position_index));
    let collateral_reward = collateral * liquidation_config.liquidator_fee.to_decimal();

    // Apply recentering
    let recenter_result = recenter_calculation(
        &comet,
        &token_data,
        comet_position_index,
        collateral_position_index,
    )?;

    // After recenter, ILD should be zero or very near zero.
    // Assume we can ignore its impact on the health score.
    let collateral_after_recenter =
        collateral - recenter_result.user_usdi_collateral_deficit - collateral_reward;

    // Calculate how much liquidity we can withdraw.
    let health_score_cutoff = token_data.il_health_score_cutoff.to_decimal();
    let position_il_coefficient = pool.asset_info.health_score_coefficient.to_decimal();

    let total_il_term_after_recenter = health_score.total_il_term - comet_position_il_term;
    let total_position_term_after_recenter = health_score.total_position_term
        - position_il_coefficient
            * (comet_position.borrowed_usdi.to_decimal() - recenter_result.user_borrowed_usdi);
    let health_score_after_recenter = Decimal::new(100, 0)
        - (total_il_term_after_recenter + total_position_term_after_recenter)
            / collateral_after_recenter;

    if health_score_after_recenter >= health_score_cutoff {
        return Ok(LiquidationResult {
            lp_tokens_to_withdraw: Decimal::ZERO,
            reward_from_collateral: collateral_reward,
            recenter_result,
        });
    }

    let usdi_position_reduction = (health_score_cutoff - health_score_after_recenter)
        * collateral_after_recenter
        / position_il_coefficient;

    let required_lp_tokens = total_lp_tokens * usdi_position_reduction
        / (pool.usdi_amount.to_decimal() - recenter_result.amm_usdi_burn);

    if required_lp_tokens <= comet_lp_tokens {
        Ok(LiquidationResult {
            lp_tokens_to_withdraw: required_lp_tokens,
            reward_from_collateral: collateral_reward,
            recenter_result,
        })
    } else {
        Ok(LiquidationResult {
            lp_tokens_to_withdraw: comet_lp_tokens,
            reward_from_collateral: Decimal::ZERO,
            recenter_result,
        })
    }
}

pub fn execute(ctx: Context<LiquidateComet>, _user_nonce: u8, position_index: u8, comet_collateral_index: u8) -> Result<()> {
    let position_index = position_index as usize;
    let manager_nonce = ctx.accounts.manager.bump;
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let pool_index = comet.positions[position_index].pool_index as usize;
    let pool = token_data.pools[pool_index];

    let usdi_comet_collateral = comet.collaterals[comet_collateral_index as usize];
    
    require!(
        usdi_comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX,
        InceptError::InvalidCollateralType
    );
    
    let comet_position = comet.positions[position_index];

    // Require unhealthy comet
    let health_score = calculate_health_score(&comet, &token_data, None)?;
    require!(
        !health_score.is_healthy(),
        InceptError::NotSubjectToLiquidation
    );

    // Require that all collateral is in USDI
    for i in 1..comet.num_collaterals as usize {
        assert!(
            comet.collaterals[i]
                .collateral_amount
                .to_decimal()
                .is_zero(),
            "All collaterals must be converted to USDI!"
        );
    }
    assert!(
        usdi_comet_collateral
            .collateral_amount
            .to_decimal() > Decimal::ZERO,
        "Must have USDI collateral!"
    );

    // Require that you liquidate the largest IL position first!
    let (impermanent_loss_term, _position_loss_term) =
        calculate_comet_position_loss(&token_data, &comet_position)?;

    for i in 0..comet.num_positions as usize {
        if i == position_index {
            continue;
        }
        let (other_impermanent_loss_term, _) =
            calculate_comet_position_loss(&token_data, &comet.positions[i])?;
        assert!(
            impermanent_loss_term >= other_impermanent_loss_term,
            "Must liquidate largest IL position first!"
        )
    }

    let liquidation_config = ctx.accounts.manager.liquidation_config;
    let mut liquidation_result = calculate_liquidation_result(
        &health_score,
        &comet,
        &token_data,
        &liquidation_config,
        position_index,
        comet_collateral_index.into(),
    )?;
    let recenter_result = liquidation_result.recenter_result;

    // Claim LP tokens, close position if needed.
    let claimable_ratio =
        liquidation_result.lp_tokens_to_withdraw / pool.liquidity_token_supply.to_decimal();
    let usdi_pool_after_recentering = pool.usdi_amount.to_decimal() - recenter_result.amm_usdi_burn;
    let iasset_pool_after_recentering =
        pool.iasset_amount.to_decimal() - recenter_result.amm_iasset_burn;
    let usdi_claimed = claimable_ratio * usdi_pool_after_recentering;
    let iasset_claimed = claimable_ratio * iasset_pool_after_recentering;

    // Adjust comet position values
    let mut liquidity_token_value = comet_position.liquidity_token_value.to_decimal()
        - liquidation_result.lp_tokens_to_withdraw;
    if liquidity_token_value.is_zero() {
        comet.remove_position(position_index);
    } else {
        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[position_index].liquidity_token_value =
            RawDecimal::from(liquidity_token_value);

        let mut borrowed_usdi = recenter_result.user_borrowed_usdi - usdi_claimed;
        borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[position_index].borrowed_usdi =
            RawDecimal::from(borrowed_usdi.max(Decimal::new(0, DEVNET_TOKEN_SCALE)));

        let mut borrowed_iasset = recenter_result.user_borrowed_iasset - iasset_claimed;
        borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[position_index].borrowed_iasset =
            RawDecimal::from(borrowed_iasset.max(Decimal::new(0, DEVNET_TOKEN_SCALE)));
    }

    // Adjust collateral values in comet data.
    let mut new_collateral = comet.collaterals[0].collateral_amount.to_decimal()
        - recenter_result.user_usdi_collateral_deficit
        - liquidation_result.reward_from_collateral;
    new_collateral.rescale(DEVNET_TOKEN_SCALE);
    comet.collaterals[0].collateral_amount = RawDecimal::from(new_collateral);

    // Transfer collateral between vault and amm
    match recenter_result
        .user_usdi_collateral_deficit
        .cmp(&Decimal::ZERO)
    {
        Ordering::Greater => {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Transfer {
                        from: ctx.accounts.usdi_vault.to_account_info().clone(),
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
        Ordering::Less => {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Transfer {
                        to: ctx.accounts.usdi_vault.to_account_info().clone(),
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
        _ => (),
    };

    // Transfer fee from vault to liquidator
    if liquidation_result.reward_from_collateral > Decimal::ZERO {
        liquidation_result
            .reward_from_collateral
            .rescale(DEVNET_TOKEN_SCALE);
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Transfer {
                    to: ctx
                        .accounts
                        .liquidator_usdi_token_account
                        .to_account_info()
                        .clone(),
                    from: ctx.accounts.usdi_vault.to_account_info().clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            liquidation_result
                .reward_from_collateral
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    }

    // adjust amm values by burn/minting correct amounts.
    let mut amm_burn_usdi = recenter_result.amm_usdi_burn + usdi_claimed;
    amm_burn_usdi.rescale(DEVNET_TOKEN_SCALE);
    let mut amm_burn_iasset = recenter_result.amm_iasset_burn + iasset_claimed;
    amm_burn_iasset.rescale(DEVNET_TOKEN_SCALE);

    // Burn or mint for amm
    match amm_burn_usdi.cmp(&Decimal::ZERO) {
        Ordering::Greater => {
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
                amm_burn_usdi.mantissa().try_into().unwrap(),
            )?;
        }
        Ordering::Less => {
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
                amm_burn_usdi.abs().mantissa().try_into().unwrap(),
            )?;
        }
        _ => (),
    }

    match amm_burn_iasset.cmp(&Decimal::ZERO) {
        Ordering::Greater => {
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
                amm_burn_iasset.mantissa().try_into().unwrap(),
            )?;
        }
        Ordering::Less => {
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
                amm_burn_iasset.abs().mantissa().try_into().unwrap(),
            )?;
        }
        _ => (),
    }

    // Burn lp tokens
    if liquidation_result.lp_tokens_to_withdraw > Decimal::ZERO {
        liquidation_result
            .lp_tokens_to_withdraw
            .rescale(DEVNET_TOKEN_SCALE);
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
            liquidation_result
                .lp_tokens_to_withdraw
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    }

    // Update token data
    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.usdi_vault.reload()?;

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

    // TODO: Adjust this properly.
    token_data.collaterals[USDI_COLLATERAL_INDEX].vault_comet_supply = RawDecimal::new(
        ctx.accounts.usdi_vault.amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
