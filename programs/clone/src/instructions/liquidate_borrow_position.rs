use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::to_ratio_decimal;
use crate::{to_clone_decimal, CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8)]
pub struct LiquidateBorrowPosition<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[user_account.load()?.borrows.positions[borrow_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    /// CHECK: Only used for address validation.
    pub user: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (borrow_index as u64) < user_account.load()?.borrows.num_positions @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        mut,
        address = token_data.load()?.pools[user_account.load()?.borrows.positions[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[user_account.load()?.borrows.positions[borrow_index as usize].collateral_index as usize].vault,
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

pub fn execute(ctx: Context<LiquidateBorrowPosition>, borrow_index: u8) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];

    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let borrows = &mut ctx.accounts.user_account.load_mut()?.borrows;
    let borrow_position = borrows.positions[borrow_index as usize];

    let collateral_scale =
        token_data.collaterals[borrow_position.collateral_index as usize].scale as u32;

    let pool = token_data.pools[borrow_position.pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];

    // ensure price data is up to date
    let slot = Clock::get()?.slot;
    check_feed_update(oracle, slot).unwrap();

    let borrowed_onasset = to_clone_decimal!(borrow_position.borrowed_onasset);
    let collateral_amount_value = Decimal::new(
        borrow_position.collateral_amount.try_into().unwrap(),
        collateral_scale,
    );

    if pool.status != Status::Liquidation as u64 {
        return_error_if_false!(
            check_mint_collateral_sufficient(
                oracle,
                borrowed_onasset,
                to_ratio_decimal!(pool.asset_info.stable_collateral_ratio),
                collateral_amount_value,
            )
            .is_err(),
            CloneError::BorrowPositionUnableToLiquidate
        );
    } else {
        check_feed_update(oracle, Clock::get()?.slot)?;
    }
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
        borrow_position.borrowed_onasset,
    )?;

    // Send the user the remaining collateral.
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

    token::transfer(send_collateral_context, borrow_position.collateral_amount)?;

    // Update data
    token_data.pools[borrow_position.pool_index as usize]
        .asset_info
        .total_borrowed_amount -= borrow_position.borrowed_onasset;
    token_data.collaterals[borrow_position.collateral_index as usize].vault_borrow_supply -=
        borrow_position.collateral_amount;

    // Remove position
    borrows.remove(borrow_index as usize);

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrow_position.pool_index.try_into().unwrap(),
        is_liquidation: true,
        collateral_supplied: 0,
        collateral_delta: -(borrow_position.collateral_amount as i64),
        collateral_index: borrow_position.collateral_index.try_into().unwrap(),
        borrowed_amount: 0,
        borrowed_delta: -(borrow_position.borrowed_onasset as i64)
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
