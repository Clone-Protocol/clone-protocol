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
#[instruction(comet_position_index: u8, comet_collateral_index: u8, amount: u64, pay_onusd_debt: bool)]
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
        has_one = comet
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
        has_one = clone,
        constraint = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].status == Status::Active as u64 ||
        token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].status == Status::Liquidation as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet @ CloneError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ CloneError::InvalidInputPositionIndex,
        constraint =  comet.load()?.num_collaterals > comet_collateral_index.into() @ CloneError::InvalidInputPositionIndex
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
        associated_token::authority = liquidator,
        associated_token::mint = vault.mint,
    )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometPosition>,
    comet_position_index: u8,
    comet_collateral_index: u8,
    amount: u64,
    pay_onusd_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let comet = &mut ctx.accounts.comet.load_mut()?;

    let comet_position = comet.positions[comet_position_index as usize];
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let authorized_amount = Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE);
    let ild_share = calculate_ild_share(&comet_position, &token_data);
    let pool_index = comet_position.pool_index as usize;
    let pool = token_data.pools[pool_index];
    let pool_oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral_index = comet_collateral.collateral_index as usize;
    let collateral = token_data.collaterals[collateral_index];
    let mut collateral_price = Decimal::one();
    if collateral.oracle_info_index != u64::MAX {
        let collateral_oracle = token_data.oracles[collateral.oracle_info_index as usize];
        check_feed_update(collateral_oracle, Clock::get()?.slot)?;
        collateral_price = collateral_oracle.price.to_decimal();
    }
    let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();
    let onusd_ild_rebate = comet_position.onusd_ild_rebate.to_decimal();
    let onasset_ild_rebate = comet_position.onasset_ild_rebate.to_decimal();

    if pool.status != Status::Liquidation as u64 {
        let starting_health_score = calculate_health_score(&comet, &token_data)?;

        return_error_if_false!(
            !starting_health_score.is_healthy(),
            CloneError::NotSubjectToLiquidation
        );
    } else {
        check_feed_update(pool_oracle, Clock::get()?.slot)?;
    }

    let mut burn_amount = if pay_onusd_debt {
        ild_share.onusd_ild_share.min(authorized_amount)
    } else {
        ild_share.onasset_ild_share.min(authorized_amount)
    };

    let burn_amount_usd_price = if pay_onusd_debt {
        Decimal::one()
    } else {
        pool_oracle.price.to_decimal()
    };
    let liquidator_fee = ctx
        .accounts
        .clone
        .liquidation_config
        .comet_liquidator_fee
        .to_decimal();

    // calculate reward for liquidator
    let mut collateral_reward = rescale_toward_zero(
        (Decimal::one() + liquidator_fee) * burn_amount_usd_price * burn_amount / collateral_price,
        collateral_scale,
    );

    if collateral_reward > comet_collateral.collateral_amount.to_decimal() {
        collateral_reward = comet_collateral.collateral_amount.to_decimal();
        burn_amount = rescale_toward_zero(
            collateral_reward * collateral_price
                / ((Decimal::one() + liquidator_fee) * burn_amount_usd_price),
            CLONE_TOKEN_SCALE,
        );
    }

    if (pay_onusd_debt && ild_share.onusd_ild_share > Decimal::ZERO)
        || (!pay_onusd_debt && ild_share.onasset_ild_share > Decimal::ZERO)
    {
        let cpi_accounts = if pay_onusd_debt {
            comet.positions[comet_position_index as usize].onusd_ild_rebate = RawDecimal::from(
                rescale_toward_zero(onusd_ild_rebate + burn_amount, CLONE_TOKEN_SCALE),
            );
            Burn {
                mint: ctx.accounts.onusd_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .liquidator_onusd_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            }
        } else {
            comet.positions[comet_position_index as usize].onasset_ild_rebate = RawDecimal::from(
                rescale_toward_zero(onasset_ild_rebate + burn_amount, CLONE_TOKEN_SCALE),
            );
            Burn {
                mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .liquidator_onasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            }
        };

        token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            burn_amount.mantissa().try_into().unwrap(),
        )?;

        // subtract collateral amount from vault supply
        let vault_comet_supply = rescale_toward_zero(
            collateral.vault_comet_supply.to_decimal() - collateral_reward,
            collateral_scale,
        );
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            RawDecimal::from(vault_comet_supply);

        // Transfer collateral to liquidator
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info().clone(),
            to: ctx
                .accounts
                .liquidator_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.clone.to_account_info().clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
            collateral_reward.mantissa().try_into().unwrap(),
        )?;

        // Remove equivalent reward from user's collateral
        let new_collateral_amount = rescale_toward_zero(
            comet.collaterals[collateral_index]
                .collateral_amount
                .to_decimal()
                - collateral_reward,
            collateral_scale,
        );
        comet.collaterals[collateral_index].collateral_amount =
            RawDecimal::from(new_collateral_amount);
    }

    // Withdraw liquidity position
    let position_committed_onusd_liquidity = comet_position.committed_onusd_liquidity.to_decimal();
    if position_committed_onusd_liquidity > Decimal::ZERO {
        withdraw_liquidity(
            token_data,
            comet,
            comet_position_index,
            position_committed_onusd_liquidity
                .mantissa()
                .try_into()
                .unwrap(),
            ctx.accounts.user.key(),
            ctx.accounts.clone.event_counter,
        )?;
    };
    ctx.accounts.clone.event_counter += 1;

    if comet.positions[comet_position_index as usize]
        .onusd_ild_rebate
        .to_decimal()
        == Decimal::ZERO
        && comet.positions[comet_position_index as usize]
            .onasset_ild_rebate
            .to_decimal()
            == Decimal::ZERO
    {
        comet.remove_position(comet_position_index as usize);
    }

    Ok(())
}
