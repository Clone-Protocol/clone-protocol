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
#[instruction(borrow_index: u8, amount: u64)]
pub struct LiquidateBorrowPosition<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    /// CHECK: Only used for address validation.
    #[account(
        address = user_account.authority
    )]
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
        has_one = borrow_positions
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        owner = *user_account.to_account_info().owner,
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ CloneError::InvalidInputPositionIndex
    )]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[borrow_positions.load()?.borrow_positions[borrow_index as usize].collateral_index as usize].vault,
        constraint = vault.mint == token_data.load()?.collaterals[borrow_positions.load()?.borrow_positions[borrow_index as usize].collateral_index as usize].mint
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = liquidator
   )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<LiquidateBorrowPosition>, borrow_index: u8, amount: u64) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];

    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut borrow_positions = ctx.accounts.borrow_positions.load_mut()?;
    let borrow_position = borrow_positions.borrow_positions[borrow_index as usize];

    let collateral = token_data.collaterals[borrow_position.collateral_index as usize];
    let pool = token_data.pools[borrow_position.pool_index as usize];
    let pool_oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];

    let authorized_amount = Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE);
    let mut collateral_price = Decimal::one();
    let mut collateral_oracle: OracleInfo = Default::default();
    if collateral.oracle_info_index != u64::MAX {
        collateral_oracle = token_data.oracles[collateral.oracle_info_index as usize];
        collateral_price = collateral_oracle.price.to_decimal();
    }
    let collateral_scale = collateral.vault_mint_supply.to_decimal().scale();

    let burn_amount = borrow_position
        .borrowed_onasset
        .to_decimal()
        .min(authorized_amount);

    if pool.status != Status::Liquidation as u64 {
        if check_mint_collateral_sufficient(
            pool_oracle,
            collateral_oracle,
            borrow_position.borrowed_onasset.to_decimal(),
            pool.asset_info.min_overcollateral_ratio.to_decimal(),
            collateral.collateralization_ratio.to_decimal(),
            borrow_position.collateral_amount.to_decimal(),
        )
        .is_ok()
        {
            return Err(CloneError::BorrowPositionUnableToLiquidate.into());
        }
    } else {
        return_error_if_false!(
            check_feed_update(pool_oracle, Clock::get()?.slot).is_ok(),
            CloneError::OutdatedOracle
        );
        if collateral_oracle != Default::default() {
            return_error_if_false!(
                check_feed_update(collateral_oracle, Clock::get()?.slot).is_ok(),
                CloneError::OutdatedOracle
            );
        }
    }

    let mut collateral_reward = rescale_toward_zero(
        (Decimal::one()
            + ctx
                .accounts
                .clone
                .liquidation_config
                .comet_liquidator_fee
                .to_decimal())
            * burn_amount
            * pool_oracle.price.to_decimal()
            / collateral_price,
        collateral_scale,
    );

    // Decrease reward if not enough collateral
    collateral_reward = borrow_position
        .collateral_amount
        .to_decimal()
        .min(collateral_reward);

    // Burn the onAsset from the liquidator
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .liquidator_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.liquidator.to_account_info().clone(),
    };
    let burn_liquidator_onasset_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::burn(
        burn_liquidator_onasset_context,
        burn_amount.mantissa().try_into().unwrap(),
    )?;

    // Send the user the collateral reward
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .liquidator_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let send_collateral_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_collateral_context,
        collateral_reward.mantissa().try_into().unwrap(),
    )?;

    // Update data
    let new_borrowed_amount = rescale_toward_zero(
        borrow_position.borrowed_onasset.to_decimal() - burn_amount,
        CLONE_TOKEN_SCALE,
    );
    borrow_positions.borrow_positions[borrow_index as usize].borrowed_onasset =
        RawDecimal::from(new_borrowed_amount);

    let new_collateral_amount = rescale_toward_zero(
        borrow_position.collateral_amount.to_decimal() - collateral_reward,
        CLONE_TOKEN_SCALE,
    );
    borrow_positions.borrow_positions[borrow_index as usize].collateral_amount =
        RawDecimal::from(new_collateral_amount);

    let new_total_minted_amount = rescale_toward_zero(
        pool.total_minted_amount.to_decimal() - burn_amount,
        CLONE_TOKEN_SCALE,
    );
    token_data.pools[borrow_position.pool_index as usize].total_minted_amount =
        RawDecimal::from(new_total_minted_amount);

    // Remove position
    if borrow_positions.borrow_positions[borrow_index as usize]
        .borrowed_onasset
        .to_decimal()
        == Decimal::ZERO
        && borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_amount
            .to_decimal()
            == Decimal::ZERO
    {
        borrow_positions.remove(borrow_index as usize);
    }

    // Throw error if too much was liquidated
    if (collateral_price
        * borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_amount
            .to_decimal()
        * collateral.collateralization_ratio.to_decimal())
        / (pool_oracle.price.to_decimal()
            * borrow_positions.borrow_positions[borrow_index as usize]
                .borrowed_onasset
                .to_decimal())
        > pool
            .asset_info
            .max_liquidation_overcollateral_ratio
            .to_decimal()
    {
        return Err(error!(CloneError::InvalidMintCollateralRatio));
    }

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrow_positions.borrow_positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: true,
        collateral_supplied: 0,
        collateral_delta: -collateral_reward.to_i64().unwrap(),
        collateral_index: borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_index
            .try_into()
            .unwrap(),
        borrowed_amount: 0,
        borrowed_delta: -burn_amount.to_i64().unwrap()
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
