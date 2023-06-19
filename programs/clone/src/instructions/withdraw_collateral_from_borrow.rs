use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( borrow_index: u8, amount: u64)]
pub struct WithdrawCollateralFromBorrow<'info> {
    #[account(address = borrow_positions.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.borrow_positions,
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ CloneError::InvalidInputPositionIndex
    )]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[borrow_positions.load()?.borrow_positions[borrow_index as usize].collateral_index as usize].vault @ CloneError::InvalidInputCollateralAccount,
        constraint = vault.amount >= amount @ CloneError::InvalidTokenAccountBalance
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawCollateralFromBorrow>,
    borrow_index: u8,
    amount: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let borrow_positions = &mut ctx.accounts.borrow_positions.load_mut()?;

    let pool_index = borrow_positions.borrow_positions[borrow_index as usize].pool_index;
    let pool = token_data.pools[pool_index as usize];
    let collateral_ratio = pool.asset_info.stable_collateral_ratio;
    let collateral = token_data.collaterals
        [borrow_positions.borrow_positions[borrow_index as usize].collateral_index as usize];
    let mint_position = borrow_positions.borrow_positions[borrow_index as usize];

    let amount_value = Decimal::new(
        amount.try_into().unwrap(),
        collateral.vault_mint_supply.to_decimal().scale(),
    );

    // subtract collateral amount from vault supply
    let current_vault_mint_supply = collateral.vault_mint_supply.to_decimal();
    let new_vault_mint_supply = rescale_toward_zero(
        current_vault_mint_supply - amount_value,
        current_vault_mint_supply.scale(),
    );
    token_data.collaterals
        [borrow_positions.borrow_positions[borrow_index as usize].collateral_index as usize]
        .vault_mint_supply = RawDecimal::from(new_vault_mint_supply);

    // subtract collateral amount from mint data
    let new_collateral_amount = rescale_toward_zero(
        mint_position.collateral_amount.to_decimal() - amount_value,
        DEVNET_TOKEN_SCALE,
    );
    borrow_positions.borrow_positions[borrow_index as usize].collateral_amount =
        RawDecimal::from(new_collateral_amount);
    let slot = Clock::get()?.slot;

    let new_supplied_collateral = rescale_toward_zero(
        pool.supplied_mint_collateral_amount.to_decimal() - amount_value,
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[mint_position.pool_index as usize].supplied_mint_collateral_amount =
        RawDecimal::from(new_supplied_collateral);

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool.asset_info,
        mint_position.borrowed_onasset.to_decimal(),
        collateral_ratio.to_decimal(),
        borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_amount
            .to_decimal(),
        slot,
    )
    .unwrap();

    // send collateral back to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info().clone(),
        to: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        amount,
    )?;

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrow_positions.borrow_positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: false,
        collateral_supplied: new_collateral_amount.mantissa().try_into().unwrap(),
        collateral_delta: amount_value.mantissa().try_into().unwrap(),
        collateral_index: borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_index
            .try_into()
            .unwrap(),
        borrowed_amount: borrow_positions.borrow_positions[borrow_index as usize]
            .borrowed_onasset
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        borrowed_delta: 0
    });
    ctx.accounts.clone.event_counter += 1;

    // check to see if mint is empty, if so remove
    if borrow_positions.borrow_positions[borrow_index as usize]
        .collateral_amount
        .to_decimal()
        .is_zero()
    {
        borrow_positions.remove(borrow_index as usize);
    }

    Ok(())
}
