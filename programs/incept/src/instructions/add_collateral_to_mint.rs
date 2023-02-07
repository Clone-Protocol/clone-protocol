use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;
//use crate::instructions::AddCollateralToMint;

#[derive(Accounts)]
#[instruction(mint_index: u8, amount: u64)]
pub struct AddCollateralToMint<'info> {
    #[account(address = mint_positions.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager.bump,
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
        address = user_account.mint_positions,
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

pub fn execute(ctx: Context<AddCollateralToMint>, mint_index: u8, amount: u64) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

    let collateral = token_data.collaterals
        [mint_positions.mint_positions[mint_index as usize].collateral_index as usize];
    let mint_position = mint_positions.mint_positions[mint_index as usize];

    let amount_value = Decimal::new(
        amount.try_into().unwrap(),
        collateral.vault_mint_supply.to_decimal().scale(),
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

    // Add collateral to total collateral amount
    let mut new_total_supplied_collateral = token_data.pools[mint_position.pool_index as usize]
        .supplied_mint_collateral_amount
        .to_decimal()
        + amount_value;
    new_total_supplied_collateral.rescale(DEVNET_TOKEN_SCALE);
    token_data.pools[mint_position.pool_index as usize].supplied_mint_collateral_amount =
        RawDecimal::from(new_total_supplied_collateral);

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
