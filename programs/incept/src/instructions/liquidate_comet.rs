use crate::error::*;
use crate::liquidate_single_pool_comet;
use crate::math::*;
use crate::recenter_comet::recenter_calculation;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
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
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
        has_one = comet,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        constraint = comet.load()?.is_single_pool == 0,
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

pub fn calculate_collateral_reward(
    health_score: &HealthScore,
    collateral_after_recenter: &Decimal,
    impermanent_loss_term: &Decimal,
    position_loss_term: &Decimal,
    liquidation_config: &LiquidationConfig,
) -> Result<Decimal> {
    let health_score_after_recenter = Decimal::new(100, 0)
        - (health_score.total_il_term - impermanent_loss_term + health_score.total_position_term)
            / collateral_after_recenter;
    let health_score_increase_via_liquidity_withdrawal =
        position_loss_term / collateral_after_recenter;
    let loss_term_after_withdrawal = health_score.total_il_term + health_score.total_position_term
        - impermanent_loss_term
        - position_loss_term;
    // TODO: Maybe want to use a different fee other than liquidator fee.
    let target_health_score = liquidation_config.max_health_liquidation.to_decimal().min(
        health_score_after_recenter
            + health_score_increase_via_liquidity_withdrawal
                * (Decimal::one() - liquidation_config.liquidator_fee.to_decimal()),
    );
    let collateral_after_reward = collateral_after_recenter
        / (Decimal::one()
            + collateral_after_recenter * target_health_score / loss_term_after_withdrawal);

    let mut collateral_reward = collateral_after_recenter - collateral_after_reward;
    collateral_reward.rescale(DEVNET_TOKEN_SCALE);

    Ok(collateral_reward)
}

pub fn execute(ctx: Context<LiquidateComet>, _user_nonce: u8, position_index: u8) -> Result<()> {
    let position_index = position_index as usize;
    let manager_nonce = ctx.accounts.manager.bump;
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let pool_index = comet.positions[position_index].pool_index as usize;
    let pool = token_data.pools[pool_index];

    let usdi_comet_collateral = comet.collaterals[0usize];

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
            .to_decimal()
            .is_sign_positive(),
        "Must have USDI collateral!"
    );

    // Require that you liquidate the largest IL position first!
    let (impermanent_loss_term, position_loss_term) =
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

    // Recenter comet calculation
    let recenter_result = recenter_calculation(&comet, &token_data, position_index, 0)?;
    let comet_lp_tokens = comet_position.liquidity_token_value.to_decimal();

    // After recenter, ILD should be zero or very near zero.
    // Assume we can ignore its impact on the health score.
    let current_usdi_collateral = usdi_comet_collateral.collateral_amount.to_decimal();
    let collateral_after_recenter =
        current_usdi_collateral - recenter_result.user_usdi_collateral_deficit;

    // Need to calculate fee based off of what the health score increase from recentering and withdrawing liquidity would be.
    // Close out comet position if withdrawing all collateral leaves health score less than the max liquidation value.
    //
    let liquidation_config = ctx.accounts.manager.liquidation_config;

    // Case 1: More than one comet position,
    // Withdraw all liquidity for this position, reward some collateral.
    let (mut lp_to_claim, mut collateral_reward) = if comet.num_positions > 1 {
        (
            comet_lp_tokens,
            calculate_collateral_reward(
                &health_score,
                &collateral_after_recenter,
                &impermanent_loss_term,
                &position_loss_term,
                &liquidation_config,
            )?,
        )
    } else {
        // Case 2: single pool comet
        liquidate_single_pool_comet::calculate_claims(
            &comet_position,
            &usdi_comet_collateral,
            &pool,
            &recenter_result,
            &liquidation_config,
        )?
    };

    lp_to_claim.rescale(DEVNET_TOKEN_SCALE);

    let mut usdi_claimed = recenter_result.user_borrowed_usdi * lp_to_claim / comet_lp_tokens;
    usdi_claimed.rescale(DEVNET_TOKEN_SCALE);
    let mut iasset_claimed = recenter_result.user_borrowed_iasset * lp_to_claim / comet_lp_tokens;
    iasset_claimed.rescale(DEVNET_TOKEN_SCALE);

    // Adjust comet position values
    comet.positions[position_index].borrowed_usdi =
        RawDecimal::from(recenter_result.user_borrowed_usdi - usdi_claimed);
    comet.positions[position_index].borrowed_iasset =
        RawDecimal::from(recenter_result.user_borrowed_iasset - iasset_claimed);
    comet.positions[position_index].liquidity_token_value =
        RawDecimal::from(comet_lp_tokens - lp_to_claim);
    // Adjust collateral values, TODO, this!
    let new_collateral_deficit = recenter_result.user_usdi_collateral_deficit + collateral_reward;

    comet.collaterals[position_index].collateral_amount = RawDecimal::from(
        comet.collaterals[position_index]
            .collateral_amount
            .to_decimal()
            - new_collateral_deficit,
    );

    // Transfer collateral between vault and amm
    if recenter_result
        .user_usdi_collateral_deficit
        .is_sign_positive()
    {
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
    } else if recenter_result
        .user_usdi_collateral_deficit
        .is_sign_negative()
    {
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

    collateral_reward.rescale(DEVNET_TOKEN_SCALE);
    // Transfer fee from vault to liquidator
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
        collateral_reward.mantissa().try_into().unwrap(),
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
            amm_burn_usdi.mantissa().try_into().unwrap(),
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
            amm_burn_usdi.abs().mantissa().try_into().unwrap(),
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
            amm_burn_iasset.mantissa().try_into().unwrap(),
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
            amm_burn_iasset.abs().mantissa().try_into().unwrap(),
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
    token_data.collaterals[USDI_COLLATERAL_INDEX].vault_comet_supply = RawDecimal::new(
        ctx.accounts.usdi_vault.amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
