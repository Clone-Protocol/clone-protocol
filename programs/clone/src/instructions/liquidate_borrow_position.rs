use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8)]
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
        has_one = clone
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
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].deprecated == 0 @ CloneError::PoolDeprecated
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

pub fn execute(ctx: Context<LiquidateBorrowPosition>, borrow_index: u8) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];

    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut borrow_positions = ctx.accounts.borrow_positions.load_mut()?;
    let mint_position = borrow_positions.borrow_positions[borrow_index as usize];

    let collateral = token_data.collaterals[mint_position.collateral_index as usize];
    let pool = token_data.pools[mint_position.pool_index as usize];
    // Check if this position is valid for liquidation
    if collateral.stable == 0 {
        return Err(CloneError::NonStablesNotSupported.into());
    }

    // ensure price data is up to date
    let slot = Clock::get()?.slot;
    check_feed_update(pool.asset_info, slot).unwrap();

    let borrowed_onasset = mint_position.borrowed_onasset.to_decimal();
    let collateral_amount_value = mint_position.collateral_amount.to_decimal();

    // Should fail here.
    if check_mint_collateral_sufficient(
        pool.asset_info,
        borrowed_onasset,
        pool.asset_info.stable_collateral_ratio.to_decimal(),
        collateral_amount_value,
        slot,
    )
    .is_ok()
    {
        return Err(CloneError::MintPositionUnableToLiquidate.into());
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
        mint_position
            .borrowed_onasset
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
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
    let send_usdc_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_usdc_context,
        mint_position
            .collateral_amount
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
    )?;

    // Update data
    let new_minted_amount = rescale_toward_zero(
        pool.total_minted_amount.to_decimal() - borrowed_onasset,
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[mint_position.pool_index as usize].total_minted_amount =
        RawDecimal::from(new_minted_amount);

    let new_supplied_collateral = rescale_toward_zero(
        pool.supplied_mint_collateral_amount.to_decimal()
            - mint_position.collateral_amount.to_decimal(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[mint_position.pool_index as usize].supplied_mint_collateral_amount =
        RawDecimal::from(new_supplied_collateral);

    // Remove position
    borrow_positions.remove(borrow_index as usize);

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrow_positions.borrow_positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: true,
        collateral_supplied: 0,
        collateral_delta: -mint_position.collateral_amount.to_decimal().mantissa() as i64,
        collateral_index: borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_index
            .try_into()
            .unwrap(),
        borrowed_amount: 0,
        borrowed_delta: -mint_position.borrowed_onasset.to_decimal().mantissa() as i64
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
