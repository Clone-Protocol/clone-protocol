use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::recenter_comet::{recenter_calculation, RecenterResult};
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::cmp::Ordering;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(position_index: u8)]
pub struct LiquidateComet<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    /// CHECK: Only used for address validation.
    #[account(
        address = user_account.authority,
    )]
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
        constraint = (user_account.comet == *comet.to_account_info().key) || (user_account.single_pool_comets == *comet.to_account_info().key)
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
        address = incept.usdi_mint,
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

#[derive(Debug, Clone, Copy)]
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
    let (comet_position_il_term, _position_term) =
        calculate_comet_position_loss(token_data, &comet_position)?;
    // Take collateral reward
    let collateral =
        comet.calculate_effective_collateral_value(token_data, Some(collateral_position_index));
    let collateral_reward = collateral * liquidation_config.liquidator_fee.to_decimal();

    // Apply recentering
    let recenter_result = recenter_calculation(
        comet,
        token_data,
        comet_position_index,
        collateral_position_index,
    )?;

    // After recenter, ILD should be zero or very near zero.
    // Assume we can ignore its impact on the health score.
    let collateral_after_recenter = collateral - recenter_result.user_usdi_collateral_deficit;
    let collateral_after_liquidation = collateral_after_recenter - collateral_reward;

    let liquidity_proportion = comet_lp_tokens / total_lp_tokens;
    let mut usdi_pool_after_recenter = pool.usdi_amount.to_decimal()
        - recenter_result.amm_usdi_burn
        + recenter_result.user_usdi_collateral_deficit;
    usdi_pool_after_recenter.rescale(DEVNET_TOKEN_SCALE);
    let mut iasset_pool_after_recenter =
        pool.iasset_amount.to_decimal() - recenter_result.amm_iasset_burn;
    iasset_pool_after_recenter.rescale(DEVNET_TOKEN_SCALE);
    let mut claimable_usdi_after_recenter = liquidity_proportion * usdi_pool_after_recenter;
    claimable_usdi_after_recenter.rescale(DEVNET_TOKEN_SCALE);
    let mut claimable_iasset_after_recenter = liquidity_proportion * iasset_pool_after_recenter;
    claimable_iasset_after_recenter.rescale(DEVNET_TOKEN_SCALE);

    let mut ild_after_recenter =
        (recenter_result.user_borrowed_usdi - claimable_usdi_after_recenter).max(Decimal::ZERO);

    if recenter_result.user_borrowed_iasset > claimable_iasset_after_recenter {
        let mut pool_after_recenter = pool;
        pool_after_recenter.iasset_amount = RawDecimal::from(iasset_pool_after_recenter);
        pool_after_recenter.usdi_amount = RawDecimal::from(usdi_pool_after_recenter);

        let iasset_debt = recenter_result.user_borrowed_iasset - claimable_iasset_after_recenter;

        let oracle_marked_debt = pool.asset_info.price.to_decimal() * iasset_debt;

        // Adjust the debt since as we buywe increase the effective debt.
        let effective_iasset_debt = iasset_debt / (Decimal::ONE - liquidity_proportion);
        // Marked as the required USDi to buy back the iasset debt,
        let pool_marked_debt = pool_after_recenter
            .calculate_input_from_output(effective_iasset_debt, false)
            .result;

        ild_after_recenter += oracle_marked_debt.max(pool_marked_debt);
    }
    let ild_term_after_recenter =
        token_data.il_health_score_coefficient.to_decimal() * ild_after_recenter;

    // Calculate how much liquidity we can withdraw.
    let health_score_cutoff = token_data.il_health_score_cutoff.to_decimal();
    let position_health_coefficient = pool.asset_info.health_score_coefficient.to_decimal();
    let total_il_term_after_recenter =
        health_score.total_il_term - comet_position_il_term + ild_term_after_recenter;
    let total_position_term_after_recenter = health_score.total_position_term
        - position_health_coefficient
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
    let target_position_term = (Decimal::new(100, 0) - health_score_cutoff)
        * collateral_after_liquidation
        - total_il_term_after_recenter;

    let usdi_position_reduction =
        (total_position_term_after_recenter - target_position_term) / position_health_coefficient;

    let required_lp_tokens = total_lp_tokens * usdi_position_reduction / usdi_pool_after_recenter;

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

pub fn execute(
    ctx: Context<LiquidateComet>,
    position_index: u8,
    comet_collateral_index: u8,
) -> Result<()> {
    let position_index = position_index as usize;
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let is_multi_pool_comet = comet.is_single_pool == 0;

    let pool_index = comet.positions[position_index].pool_index as usize;
    let pool = token_data.pools[pool_index];

    let usdi_comet_collateral = comet.collaterals[comet_collateral_index as usize];
    return_error_if_false!(
        usdi_comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX,
        InceptError::InvalidCollateralType
    );
    let comet_position = comet.positions[position_index];

    return_error_if_false!(
        usdi_comet_collateral.collateral_amount.to_decimal() > Decimal::ZERO,
        InceptError::InvalidTokenAmount
    );

    // Require unhealthy comet
    let health_score = calculate_health_score(
        &comet,
        &token_data,
        if is_multi_pool_comet {
            None
        } else {
            Some(position_index)
        },
    )?;
    return_error_if_false!(
        !health_score.is_healthy(),
        InceptError::NotSubjectToLiquidation
    );

    if is_multi_pool_comet {
        // Require that all collateral is in USDI
        for i in 1..comet.num_collaterals as usize {
            return_error_if_false!(
                comet.collaterals[i]
                    .collateral_amount
                    .to_decimal()
                    .is_zero(),
                InceptError::RequireOnlyUSDiCollateral
            );
        }

        // Require that you liquidate the largest IL position first!
        let (impermanent_loss_term, _position_loss_term) =
            calculate_comet_position_loss(&token_data, &comet_position)?;

        for i in 0..comet.num_positions as usize {
            if i == position_index {
                continue;
            }
            let (other_impermanent_loss_term, _) =
                calculate_comet_position_loss(&token_data, &comet.positions[i])?;
            return_error_if_false!(
                impermanent_loss_term >= other_impermanent_loss_term,
                InceptError::RequireLargestILDPositionFirst
            )
        }
    }

    let liquidation_config = ctx.accounts.incept.liquidation_config;
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
    let usdi_pool_after_recentering = pool.usdi_amount.to_decimal() - recenter_result.amm_usdi_burn
        + recenter_result.user_usdi_collateral_deficit;
    let iasset_pool_after_recentering =
        pool.iasset_amount.to_decimal() - recenter_result.amm_iasset_burn;
    let usdi_claimed = claimable_ratio * usdi_pool_after_recentering;
    let iasset_claimed = claimable_ratio * iasset_pool_after_recentering;

    // Adjust comet position values
    let mut liquidity_token_value = comet_position.liquidity_token_value.to_decimal()
        - liquidation_result.lp_tokens_to_withdraw;
    if liquidity_token_value.is_zero() && is_multi_pool_comet {
        // NOTE: In theory should never be possible to fully liquidate a single pool comet.
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
    let mut new_collateral = comet.collaterals[comet_collateral_index as usize]
        .collateral_amount
        .to_decimal()
        - recenter_result.user_usdi_collateral_deficit
        - liquidation_result.reward_from_collateral;
    new_collateral.rescale(DEVNET_TOKEN_SCALE);
    comet.collaterals[comet_collateral_index as usize].collateral_amount =
        RawDecimal::from(new_collateral);

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
                        authority: ctx.accounts.incept.to_account_info().clone(),
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
                        authority: ctx.accounts.incept.to_account_info().clone(),
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
                    authority: ctx.accounts.incept.to_account_info().clone(),
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
                        authority: ctx.accounts.incept.to_account_info().clone(),
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
                        authority: ctx.accounts.incept.to_account_info().clone(),
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
                        authority: ctx.accounts.incept.to_account_info().clone(),
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
                        authority: ctx.accounts.incept.to_account_info().clone(),
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
                    authority: ctx.accounts.incept.to_account_info().clone(),
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

    let usdi_delta =
        (amm_burn_usdi.mantissa() as i64) * if amm_burn_usdi > Decimal::ZERO { -1 } else { 1 };
    let iasset_delta = (amm_burn_iasset.mantissa() as i64)
        * if amm_burn_iasset > Decimal::ZERO {
            -1
        } else {
            1
        };

    emit!(LiquidityDelta {
        event_id: ctx.accounts.incept.event_counter,
        user: ctx.accounts.user.key(),
        pool_index: pool_index.try_into().unwrap(),
        is_concentrated: true,
        lp_token_delta: -(liquidation_result.lp_tokens_to_withdraw.mantissa() as i64),
        usdi_delta,
        iasset_delta,
    });

    let pool = token_data.pools[pool_index as usize];
    let mut oracle_price = pool.asset_info.price.to_decimal();
    oracle_price.rescale(DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.incept.event_counter,
        pool_index: pool_index.try_into().unwrap(),
        iasset: ctx.accounts.amm_iasset_token_account.amount,
        usdi: ctx.accounts.amm_usdi_token_account.amount,
        lp_tokens: pool
            .liquidity_token_supply
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.incept.event_counter += 1;

    Ok(())
}
