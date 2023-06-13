use crate::error::*;
use crate::instructions::withdraw_liquidity;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, amount: u64, pay_onusd_debt: bool)]
pub struct LiquidateCometPosition<'info> {
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
        constraint = comet.to_account_info().key() == user_account.comet @ CloneError::InvalidAccountLoaderOwner,
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
        address = token_data.load()?.collaterals[ONUSD_COLLATERAL_INDEX].vault,
   )]
    pub onusd_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometPosition>,
    comet_position_index: u8,
    amount: u64,
    pay_onusd_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let comet = &mut ctx.accounts.comet.load_mut()?;

    let starting_health_score = calculate_health_score(&comet, &token_data)?;

    return_error_if_false!(
        !starting_health_score.is_healthy(),
        CloneError::NotSubjectToLiquidation
    );

    // Check that they only have onUSD collateral.
    for i in 1..comet.num_collaterals as usize {
        return_error_if_false!(
            comet.collaterals[i]
                .collateral_amount
                .to_decimal()
                .is_zero(),
            CloneError::RequireOnlyonUSDCollateral
        );
    }

    let comet_position = comet.positions[comet_position_index as usize];
    let authorized_amount = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
    let ild_share = calculate_ild_share(&comet_position, &token_data);
    let pool_index = comet_position.pool_index as usize;
    let pool = token_data.pools[pool_index];
    let onusd_ild_rebate = comet_position.onusd_ild_rebate.to_decimal();
    let onasset_ild_rebate = comet_position.onasset_ild_rebate.to_decimal();

    // Calculate how much ILD to pay off
    if (pay_onusd_debt && ild_share.onusd_ild_share > Decimal::ZERO)
        || (!pay_onusd_debt && ild_share.onasset_ild_share > Decimal::ZERO)
    {
        let (cpi_accounts, burn_amount) = if pay_onusd_debt {
            let burn_amount = ild_share.onusd_ild_share.min(authorized_amount);
            comet.positions[comet_position_index as usize].onusd_ild_rebate = RawDecimal::from(
                rescale_toward_zero(onusd_ild_rebate + burn_amount, DEVNET_TOKEN_SCALE),
            );
            (
                Burn {
                    mint: ctx.accounts.onusd_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .liquidator_onusd_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                },
                burn_amount,
            )
        } else {
            let burn_amount = ild_share.onasset_ild_share.min(authorized_amount);
            comet.positions[comet_position_index as usize].onasset_ild_rebate = RawDecimal::from(
                rescale_toward_zero(onasset_ild_rebate + burn_amount, DEVNET_TOKEN_SCALE),
            );
            (
                Burn {
                    mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                    from: ctx
                        .accounts
                        .liquidator_onasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                },
                burn_amount,
            )
        };

        token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            burn_amount.mantissa().try_into().unwrap(),
        )?;

        // Reward liquidator
        let onusd_reward = rescale_toward_zero(
            Decimal::one()
                + ctx
                    .accounts
                    .clone
                    .liquidation_config
                    .liquidator_fee
                    .to_decimal()
                    * if pay_onusd_debt {
                        burn_amount
                    } else {
                        burn_amount * pool.asset_info.price.to_decimal()
                    },
            DEVNET_TOKEN_SCALE,
        );

        // Mint onusd to liquidator
        let cpi_accounts = MintTo {
            mint: ctx.accounts.onusd_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .liquidator_onusd_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
            onusd_reward.mantissa().try_into().unwrap(),
        )?;

        // Remove equivalent onusd reward from user's collateral
        let new_collateral_onusd = rescale_toward_zero(
            comet.collaterals[ONUSD_COLLATERAL_INDEX]
                .collateral_amount
                .to_decimal()
                - onusd_reward,
            DEVNET_TOKEN_SCALE,
        );
        comet.collaterals[ONUSD_COLLATERAL_INDEX].collateral_amount =
            RawDecimal::from(new_collateral_onusd);

        // Check final health score.
        let final_health_score = calculate_health_score(&comet, &token_data)?;

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
    }

    withdraw_liquidity(
        &mut token_data,
        &mut comet.positions[comet_position_index as usize],
        comet_position
            .committed_onusd_liquidity
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        ctx.accounts.user.key(),
        ctx.accounts.clone.event_counter,
    )?;
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
