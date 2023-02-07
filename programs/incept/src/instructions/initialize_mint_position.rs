use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( pool_index: u8, collateral_index: u8, iasset_amount: u64, collateral_amount: u64)]
pub struct InitializeMintPosition<'info> {
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
    )]
    pub mint_positions: AccountLoader<'info, MintPositions>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[collateral_index as usize].vault
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_collateral_token_account.amount >= collateral_amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = user
    )]
    pub user_iasset_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<InitializeMintPosition>,

    pool_index: u8,
    _collateral_index: u8,
    iasset_amount: u64,
    collateral_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&ctx.accounts.manager.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let pool = token_data.pools[pool_index as usize];

    let (collateral, collateral_index) =
        TokenData::get_collateral_tuple(&*token_data, *ctx.accounts.vault.to_account_info().key)
            .unwrap();

    let collateral_scale = collateral.vault_mint_supply.to_decimal().scale();

    let collateral_amount_value =
        Decimal::new(collateral_amount.try_into().unwrap(), collateral_scale);
    let iasset_amount_value = Decimal::new(iasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    // check to see if collateral is stable
    return_error_if_false!(collateral.stable == 1, InceptError::InvalidCollateralType);

    let collateral_ratio = pool.asset_info.stable_collateral_ratio.to_decimal();

    // ensure position sufficiently over collateralized and oracle prices are up to date
    let slot = Clock::get()?.slot;
    check_mint_collateral_sufficient(
        pool.asset_info,
        iasset_amount_value,
        collateral_ratio,
        collateral_amount_value,
        slot,
    )?;

    // lock user collateral in vault
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

    token::transfer(
        CpiContext::new(cpi_program, cpi_accounts),
        collateral_amount,
    )?;

    // mint iasset to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        iasset_amount,
    )?;

    // set mint position data
    let mut mint_positions = ctx.accounts.mint_positions.load_mut()?;
    let num_positions = mint_positions.num_positions;
    mint_positions.mint_positions[num_positions as usize] = MintPosition {
        authority: *ctx.accounts.user.to_account_info().key,
        collateral_amount: RawDecimal::from(collateral_amount_value),
        collateral_index: collateral_index.try_into().unwrap(),
        pool_index: pool_index.try_into().unwrap(),
        borrowed_iasset: RawDecimal::from(iasset_amount_value),
    };

    let current_vault_mint_supply = collateral.vault_mint_supply.to_decimal();
    let mut new_vault_mint_supply = current_vault_mint_supply + collateral_amount_value;
    new_vault_mint_supply.rescale(collateral_scale);
    // add collateral amount to vault supply
    token_data.collaterals[collateral_index].vault_mint_supply =
        RawDecimal::from(new_vault_mint_supply);

    // Update token data
    let mut total_minted_amount = token_data.pools[pool_index as usize]
        .total_minted_amount
        .to_decimal()
        + iasset_amount_value;
    total_minted_amount.rescale(DEVNET_TOKEN_SCALE);
    token_data.pools[pool_index as usize].total_minted_amount =
        RawDecimal::from(total_minted_amount);

    let mut supplied_collateral = token_data.pools[pool_index as usize]
        .supplied_mint_collateral_amount
        .to_decimal()
        + collateral_amount_value;
    supplied_collateral.rescale(DEVNET_TOKEN_SCALE);
    token_data.pools[pool_index as usize].supplied_mint_collateral_amount =
        RawDecimal::from(supplied_collateral);

    // increment number of mint positions
    mint_positions.num_positions += 1;

    Ok(())
}
