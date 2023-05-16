use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( borrow_index: u8, amount: u64)]
pub struct AddiAssetToBorrow<'info> {
    #[account(address = borrow_positions.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = user
    )]
    pub user_iasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = user_account.borrow_positions,
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    #[account(
        mut,
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<AddiAssetToBorrow>, borrow_index: u8, amount: u64) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let borrow_positions = &mut ctx.accounts.borrow_positions.load_mut()?;

    let amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let pool_index = borrow_positions.borrow_positions[borrow_index as usize].pool_index;
    let pool = token_data.pools[pool_index as usize];
    let mint_position = borrow_positions.borrow_positions[borrow_index as usize];
    let collateral_ratio = pool.asset_info.stable_collateral_ratio.to_decimal();

    // update total amount of borrowed iasset
    let new_minted_amount = rescale_toward_zero(
        mint_position.borrowed_iasset.to_decimal() + amount_value,
        DEVNET_TOKEN_SCALE,
    );
    borrow_positions.borrow_positions[borrow_index as usize].borrowed_iasset =
        RawDecimal::from(new_minted_amount);

    let slot = Clock::get()?.slot;

    // Update protocol-wide total
    let total_minted = rescale_toward_zero(
        pool.total_minted_amount.to_decimal() + amount_value,
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].total_minted_amount = RawDecimal::from(total_minted);

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        pool.asset_info,
        borrow_positions.borrow_positions[borrow_index as usize]
            .borrowed_iasset
            .to_decimal(),
        collateral_ratio,
        mint_position.collateral_amount.to_decimal(),
        slot,
    )
    .unwrap();

    // mint iasset to the user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::mint_to(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        amount,
    )?;

    Ok(())
}
