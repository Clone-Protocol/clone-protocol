use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;
//use crate::instructions::AddCollateralToMint;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, mint_index: u8, amount: u64)]
pub struct AddCollateralToMint<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &mint_positions.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (mint_index as u64) < mint_positions.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub mint_positions: AccountLoader<'info, MintPositions>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[mint_positions.load()?.mint_positions[mint_index as usize].collateral_index as usize].vault
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_collateral_token_account.amount >= amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<AddCollateralToMint>,
    _manager_nonce: u8,
    mint_index: u8,
    amount: u64,
) -> ProgramResult {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

    let collateral = token_data.collaterals
        [mint_positions.mint_positions[mint_index as usize].collateral_index as usize];
    let mint_position = mint_positions.mint_positions[mint_index as usize];

    let amount_value = Decimal::new(
        amount.try_into().unwrap(),
        collateral
            .vault_mint_supply
            .to_decimal()
            .scale()
            .try_into()
            .unwrap(),
    );

    // add collateral amount to vault supply
    let current_vault_mint_supply = collateral.vault_mint_supply.to_decimal();
    let mut new_vault_mint_supply = current_vault_mint_supply + amount_value;
    new_vault_mint_supply.rescale(current_vault_mint_supply.scale());
    token_data.collaterals
        [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
        .vault_mint_supply = RawDecimal::from(new_vault_mint_supply);

    // add collateral amount to mint data
    let current_collateral_amount = mint_position.collateral_amount.to_decimal();
    let mut new_collateral_amount = current_collateral_amount + amount_value;
    new_collateral_amount.rescale(current_collateral_amount.scale());
    mint_positions.mint_positions[mint_index as usize].collateral_amount =
        RawDecimal::from(new_collateral_amount);

    // send collateral to vault
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        to: ctx.accounts.vault.to_account_info().clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();

    token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    Ok(())
}
