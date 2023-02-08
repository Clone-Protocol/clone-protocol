use crate::error::*;
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
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        has_one = incept
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
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        owner = *user_account.to_account_info().owner,
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ InceptError::InvalidInputPositionIndex
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
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = liquidator
   )]
    pub liquidator_collateral_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_iasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<LiquidateBorrowPosition>, borrow_index: u8) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];

    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut borrow_positions = ctx.accounts.borrow_positions.load_mut()?;
    let mint_position = borrow_positions.borrow_positions[borrow_index as usize];

    let collateral = token_data.collaterals[mint_position.collateral_index as usize];
    let pool = token_data.pools[mint_position.pool_index as usize];
    // Check if this position is valid for liquidation
    if collateral.stable == 0 {
        return Err(InceptError::NonStablesNotSupported.into());
    }

    // ensure price data is up to date
    let slot = Clock::get()?.slot;
    check_feed_update(pool.asset_info, slot).unwrap();

    let borrowed_iasset = mint_position.borrowed_iasset.to_decimal();
    let collateral_amount_value = mint_position.collateral_amount.to_decimal();

    // Should fail here.
    if check_mint_collateral_sufficient(
        pool.asset_info,
        borrowed_iasset,
        pool.asset_info.stable_collateral_ratio.to_decimal(),
        collateral_amount_value,
        slot,
    )
    .is_ok()
    {
        return Err(InceptError::MintPositionUnableToLiquidate.into());
    }

    // Burn the iAsset from the liquidator
    let cpi_accounts = Burn {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .liquidator_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.liquidator.to_account_info().clone(),
    };
    let burn_liquidator_iasset_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::burn(
        burn_liquidator_iasset_context,
        mint_position
            .borrowed_iasset
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
        authority: ctx.accounts.incept.to_account_info().clone(),
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
    let mut new_minted_amount = pool.total_minted_amount.to_decimal() - borrowed_iasset;
    new_minted_amount.rescale(DEVNET_TOKEN_SCALE);
    token_data.pools[mint_position.pool_index as usize].total_minted_amount =
        RawDecimal::from(new_minted_amount);

    let mut new_supplied_collateral = pool.supplied_mint_collateral_amount.to_decimal()
        - mint_position.collateral_amount.to_decimal();
    new_supplied_collateral.rescale(DEVNET_TOKEN_SCALE);
    token_data.pools[mint_position.pool_index as usize].supplied_mint_collateral_amount =
        RawDecimal::from(new_supplied_collateral);

    // Remove position
    borrow_positions.remove(borrow_index as usize);

    Ok(())
}
