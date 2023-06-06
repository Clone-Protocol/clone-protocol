use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, amount: u64, pay_onusd_debt: bool)]
pub struct LiquidateCometILD<'info> {
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
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet || comet.to_account_info().key() == user_account.single_pool_comets @ CloneError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ CloneError::InvalidInputPositionIndex,
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
        associated_token::authority = liquidator,
        associated_token::mint = onusd_mint,
    )]
    pub liquidator_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = onasset_mint,
    )]
    pub liquidator_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onusd_token_account
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onasset_token_account
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[ONUSD_COLLATERAL_INDEX].vault,
   )]
    pub onusd_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometILD>,
    comet_position_index: u8,
    amount: u64,
    pay_onusd_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = ctx.accounts.token_data.load()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let is_single_pool = comet.is_single_pool == 1;

    let starting_health_score = calculate_health_score(
        &comet,
        &token_data,
        if is_single_pool {
            Some(comet_position_index as usize)
        } else {
            None
        },
    )?;

    return_error_if_false!(
        !starting_health_score.is_healthy(),
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
    let authorized_amount = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
    let pool_index = comet_position.pool_index as usize;
    let pool = token_data.pools[pool_index];
    let claimable_ratio = calculate_liquidity_proportion_from_liquidity_tokens(
        comet_position.liquidity_token_value.to_decimal(),
        pool.liquidity_token_supply.to_decimal(),
    );

    let (from_context, mint_context, mut payment_amount) = if pay_onusd_debt {
        let claimable_onusd = claimable_ratio * pool.onusd_amount.to_decimal();
        let borrowed_onusd = comet_position.borrowed_onusd.to_decimal();
        return_error_if_false!(
            claimable_onusd < borrowed_onusd,
            CloneError::InvalidTokenAmount
        );
        let ild_amount = borrowed_onusd - claimable_onusd;

        let (mut new_borrowed_amount, payment_amount) = if ild_amount < authorized_amount {
            (claimable_onusd, ild_amount)
        } else {
            (borrowed_onusd - authorized_amount, authorized_amount)
        };
        new_borrowed_amount = rescale_toward_zero(new_borrowed_amount, DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_onusd =
            RawDecimal::from(new_borrowed_amount);
        (
            ctx.accounts
                .liquidator_onusd_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.onusd_mint.to_account_info().clone(),
            payment_amount,
        )
    } else {
        let claimable_onasset = claimable_ratio * pool.onasset_amount.to_decimal();
        let borrowed_onasset = comet_position.borrowed_onasset.to_decimal();
        return_error_if_false!(
            claimable_onasset < borrowed_onasset,
            CloneError::InvalidTokenAmount
        );
        let ild_amount = borrowed_onasset - claimable_onasset;

        let (mut new_borrowed_amount, payment_amount) = if ild_amount < authorized_amount {
            (claimable_onasset, ild_amount)
        } else {
            (borrowed_onasset - authorized_amount, authorized_amount)
        };

        new_borrowed_amount = rescale_toward_zero(new_borrowed_amount, DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_onasset =
            RawDecimal::from(new_borrowed_amount);

        (
            ctx.accounts
                .liquidator_onasset_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.onasset_mint.to_account_info().clone(),
            payment_amount,
        )
    };
    payment_amount = rescale_toward_zero(payment_amount, DEVNET_TOKEN_SCALE);

    let cpi_accounts = Burn {
        from: from_context,
        mint: mint_context,
        authority: ctx.accounts.liquidator.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        payment_amount.mantissa().try_into().unwrap(),
    )?;

    // Reward liquidator
    let mut onusd_reward = (Decimal::one()
        + ctx
            .accounts
            .clone
            .liquidation_config
            .liquidator_fee
            .to_decimal())
        * if pay_onusd_debt {
            payment_amount
        } else {
            payment_amount * pool.asset_info.price.to_decimal()
        };
    onusd_reward = rescale_toward_zero(onusd_reward, DEVNET_TOKEN_SCALE);

    let cpi_accounts = Transfer {
        from: ctx.accounts.onusd_vault.to_account_info().clone(),
        to: ctx
            .accounts
            .liquidator_onusd_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        onusd_reward.mantissa().try_into().unwrap(),
    )?;

    let collateral_index = if is_single_pool {
        comet_position_index as usize
    } else {
        0
    };
    let new_collateral_onusd = rescale_toward_zero(
        comet.collaterals[collateral_index]
            .collateral_amount
            .to_decimal()
            - onusd_reward,
        DEVNET_TOKEN_SCALE,
    );
    comet.collaterals[collateral_index].collateral_amount = RawDecimal::from(new_collateral_onusd);

    // Check final health score.
    let final_health_score = calculate_health_score(
        &comet,
        &token_data,
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

    Ok(())
}
