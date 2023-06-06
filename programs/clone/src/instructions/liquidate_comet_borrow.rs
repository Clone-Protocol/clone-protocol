use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, liquidity_token_amount: u64)]
pub struct LiquidateCometBorrow<'info> {
    pub liquidator: Signer<'info>,
    /// CHECK: Only used for address validation.
    #[account(
        address = user_account.authority
    )]
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet || comet.to_account_info().key() == user_account.single_pool_comets,
        constraint = comet.load()?.is_single_pool == 0 || comet.load()?.is_single_pool == 1 @ CloneError::WrongCometType,
        constraint = (comet_position_index as u64) < comet.load()?.num_positions @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].deprecated == 0 @ CloneError::PoolDeprecated
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onusd_token_account,
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onasset_token_account,
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
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
        associated_token::mint = onasset_mint,
        associated_token::authority = user,
    )]
    pub liquidator_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = user,
    )]
    pub liquidator_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[ONUSD_COLLATERAL_INDEX].vault,
   )]
    pub onusd_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometBorrow>,
    comet_position_index: u8,
    liquidity_token_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let is_single_pool = comet.is_single_pool == 1;
    let comet_collateral_index = if is_single_pool {
        comet_position_index as usize
    } else {
        0
    };

    let starting_health_score = calculate_health_score(
        &comet,
        token_data,
        if is_single_pool {
            Some(comet_position_index as usize)
        } else {
            None
        },
    )?;
    return_error_if_false!(
        !starting_health_score.is_healthy() && starting_health_score.total_il_term.is_zero(),
        CloneError::NotSubjectToLiquidation
    );
    // If multipool check that they only have onUSD collateral.
    if !is_single_pool {
        for i in 1..comet.num_collaterals as usize {
            return_error_if_false!(
                comet.collaterals[i]
                    .collateral_amount
                    .to_decimal()
                    .is_zero(),
                CloneError::RequireOnlyonUSDCollateral
            );
        }
    }

    let comet_position = comet.positions[comet_position_index as usize];
    let pool_index = comet_position.pool_index;
    let comet_liquidity_tokens = comet_position.liquidity_token_value.to_decimal();

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    )
    .min(comet_liquidity_tokens);

    let onasset_amm_value = Decimal::new(
        ctx.accounts
            .amm_onasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let onusd_amm_value = Decimal::new(
        ctx.accounts
            .amm_onusd_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let liquidity_token_supply = Decimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let lp_position_claimable_ratio = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );

    let borrowed_onusd = comet_position.borrowed_onusd.to_decimal();
    let borrowed_onasset = comet_position.borrowed_onasset.to_decimal();

    let claimable_onusd = rescale_toward_zero(
        lp_position_claimable_ratio * onusd_amm_value,
        DEVNET_TOKEN_SCALE,
    );
    let claimable_onasset = rescale_toward_zero(
        lp_position_claimable_ratio * onasset_amm_value,
        DEVNET_TOKEN_SCALE,
    );

    let (mut onusd_to_burn, mut onusd_reward) = if claimable_onusd > borrowed_onusd {
        comet.positions[comet_position_index as usize].borrowed_onusd =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
        (borrowed_onusd, claimable_onusd - borrowed_onusd)
    } else {
        let new_borrowed_onusd =
            rescale_toward_zero(borrowed_onusd - claimable_onusd, DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_onusd =
            RawDecimal::from(new_borrowed_onusd);
        (claimable_onusd, Decimal::zero())
    };

    let (mut onasset_to_burn, mut onasset_reward) = if claimable_onasset > borrowed_onasset {
        comet.positions[comet_position_index as usize].borrowed_onasset =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
        (borrowed_onasset, claimable_onasset - borrowed_onasset)
    } else {
        let new_borrowed_onasset =
            rescale_toward_zero(borrowed_onasset - claimable_onasset, DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_onasset =
            RawDecimal::from(new_borrowed_onasset);
        (claimable_onasset, Decimal::zero())
    };

    // Send onusd reward from amm to user
    onusd_reward = rescale_toward_zero(onusd_reward, DEVNET_TOKEN_SCALE);
    if onusd_reward > Decimal::ZERO {
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .amm_onusd_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .liquidator_onusd_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        let transfer_onusd_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::transfer(
            transfer_onusd_context,
            onusd_reward.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn onUSD from amm
    onusd_to_burn = rescale_toward_zero(onusd_to_burn, DEVNET_TOKEN_SCALE);
    if onusd_to_burn > Decimal::ZERO {
        let cpi_accounts = Burn {
            mint: ctx.accounts.onusd_mint.to_account_info().clone(),
            from: ctx
                .accounts
                .amm_onusd_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        let burn_onasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::burn(
            burn_onasset_context,
            onusd_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    // Send onasset reward from amm to user
    onasset_reward = rescale_toward_zero(onasset_reward, DEVNET_TOKEN_SCALE);
    if onasset_reward > Decimal::ZERO {
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .amm_onasset_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .liquidator_onasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        let transfer_onasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::transfer(
            transfer_onasset_context,
            onasset_reward.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn onasset from amm
    onasset_to_burn = rescale_toward_zero(onasset_to_burn, DEVNET_TOKEN_SCALE);
    if onasset_to_burn > Decimal::ZERO {
        let burn_onasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .amm_onasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            seeds,
        );
        token::burn(
            burn_onasset_context,
            onasset_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn LP tokens.
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
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            seeds,
        ),
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

    // Remove lp tokens from user
    let new_comet_liquidity_tokens = rescale_toward_zero(
        comet_liquidity_tokens - liquidity_token_value,
        DEVNET_TOKEN_SCALE,
    );
    comet.positions[comet_position_index as usize].liquidity_token_value =
        RawDecimal::from(new_comet_liquidity_tokens);

    // update pool data
    ctx.accounts.amm_onasset_token_account.reload()?;
    ctx.accounts.amm_onusd_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[comet_position.pool_index as usize].onasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_onasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[comet_position.pool_index as usize].onusd_amount = RawDecimal::new(
        ctx.accounts
            .amm_onusd_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    // Reward liquidator
    let onusd_reward = rescale_toward_zero(
        ctx.accounts
            .clone
            .liquidation_config
            .liquidator_fee
            .to_decimal()
            * onusd_to_burn,
        DEVNET_TOKEN_SCALE,
    );

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                to: ctx
                    .accounts
                    .liquidator_onusd_token_account
                    .to_account_info()
                    .clone(),
                from: ctx.accounts.onusd_vault.to_account_info().clone(),
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            seeds,
        ),
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;
    let new_collateral_amount = rescale_toward_zero(
        comet.collaterals[comet_collateral_index]
            .collateral_amount
            .to_decimal()
            - onusd_reward,
        DEVNET_TOKEN_SCALE,
    );
    comet.collaterals[comet_collateral_index].collateral_amount =
        RawDecimal::from(new_collateral_amount);

    // Check health score.
    let final_health_score = calculate_health_score(
        &comet,
        token_data,
        if is_single_pool {
            Some(comet_position_index as usize)
        } else {
            None
        },
    )?;

    return_error_if_false!(
        final_health_score.score
            <= ctx
                .accounts
                .clone
                .liquidation_config
                .max_health_liquidation
                .to_decimal(),
        CloneError::LiquidationAmountTooLarge
    );

    return_error_if_false!(
        starting_health_score.score < final_health_score.score,
        CloneError::HealthScoreTooLow
    );

    // TODO: Add in a liquidation event
    emit!(LiquidityDelta {
        event_id: ctx.accounts.clone.event_counter,
        user: ctx.accounts.user.key(),
        pool_index: pool_index.try_into().unwrap(),
        is_concentrated: true,
        lp_token_delta: -(liquidity_token_value.mantissa() as i64),
        onusd_delta: -(onusd_to_burn.mantissa() as i64),
        onasset_delta: -(onasset_to_burn.mantissa() as i64),
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index: pool_index.try_into().unwrap(),
        onasset: ctx.accounts.amm_onasset_token_account.amount,
        onusd: ctx.accounts.amm_onusd_token_account.amount,
        lp_tokens: pool
            .liquidity_token_supply
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
