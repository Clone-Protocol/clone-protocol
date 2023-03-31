use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, amount: u64, pay_usdi_debt: bool)]
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
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet || comet.to_account_info().key() == user_account.single_pool_comets @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = usdi_mint,
    )]
    pub liquidator_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = liquidator,
        associated_token::mint = iasset_mint,
    )]
    pub liquidator_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault,
   )]
    pub usdi_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometILD>,
    comet_position_index: u8,
    amount: u64,
    pay_usdi_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, InceptError::InvalidTokenAmount);
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
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
        InceptError::NotSubjectToLiquidation
    );

    // If multipool check that they only have USDi collateral.
    if !is_single_pool {
        for i in 1..comet.num_collaterals as usize {
            return_error_if_false!(
                comet.collaterals[i]
                    .collateral_amount
                    .to_decimal()
                    .is_zero(),
                InceptError::RequireOnlyUSDiCollateral
            );
        }
    }

    let comet_position = comet.positions[comet_position_index as usize];
    let authorized_amount = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
    let pool_index = comet_position.pool_index as usize;
    let pool = token_data.pools[pool_index];
    let claimable_ratio = comet_position.liquidity_token_value.to_decimal()
        / pool.liquidity_token_supply.to_decimal();

    let (from_context, mint_context, mut payment_amount) = if pay_usdi_debt {
        let claimable_usdi = claimable_ratio * pool.usdi_amount.to_decimal();
        let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
        return_error_if_false!(
            claimable_usdi < borrowed_usdi,
            InceptError::InvalidTokenAmount
        );
        let ild_amount = borrowed_usdi - claimable_usdi;

        let (mut new_borrowed_amount, payment_amount) = if ild_amount < authorized_amount {
            (claimable_usdi, ild_amount)
        } else {
            (borrowed_usdi - authorized_amount, authorized_amount)
        };
        new_borrowed_amount.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_amount);
        (
            ctx.accounts
                .liquidator_usdi_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.usdi_mint.to_account_info().clone(),
            payment_amount,
        )
    } else {
        let claimable_iasset = claimable_ratio * pool.iasset_amount.to_decimal();
        let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();
        return_error_if_false!(
            claimable_iasset < borrowed_iasset,
            InceptError::InvalidTokenAmount
        );
        let ild_amount = borrowed_iasset - claimable_iasset;

        let (mut new_borrowed_amount, payment_amount) = if ild_amount < authorized_amount {
            (claimable_iasset, ild_amount)
        } else {
            (borrowed_iasset - authorized_amount, authorized_amount)
        };

        new_borrowed_amount.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_amount);

        (
            ctx.accounts
                .liquidator_iasset_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.iasset_mint.to_account_info().clone(),
            payment_amount,
        )
    };
    payment_amount.rescale(DEVNET_TOKEN_SCALE);

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
    let mut usdi_reward = (Decimal::one()
        + ctx
            .accounts
            .incept
            .liquidation_config
            .liquidator_fee
            .to_decimal())
        * if pay_usdi_debt {
            payment_amount
        } else {
            payment_amount * pool.asset_info.price.to_decimal()
        };
    usdi_reward.rescale(DEVNET_TOKEN_SCALE);

    let cpi_accounts = Transfer {
        from: ctx.accounts.usdi_vault.to_account_info().clone(),
        to: ctx
            .accounts
            .liquidator_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        usdi_reward.mantissa().try_into().unwrap(),
    )?;

    let collateral_index = if is_single_pool {
        comet_position_index as usize
    } else {
        0
    };
    let mut new_collateral_usdi = comet.collaterals[collateral_index]
        .collateral_amount
        .to_decimal()
        - usdi_reward;
    new_collateral_usdi.rescale(DEVNET_TOKEN_SCALE);
    comet.collaterals[collateral_index].collateral_amount = RawDecimal::from(new_collateral_usdi);

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
                .incept
                .liquidation_config
                .max_health_liquidation
                .to_decimal(),
        InceptError::LiquidationAmountTooLarge
    );

    return_error_if_false!(
        starting_health_score.score < final_health_score.score,
        InceptError::HealthScoreTooLow
    );

    Ok(())
}