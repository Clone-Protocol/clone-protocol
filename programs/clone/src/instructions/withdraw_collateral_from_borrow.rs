use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::{to_clone_decimal, to_ratio_decimal, CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8, amount: u64)]
pub struct WithdrawCollateralFromBorrow<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (borrow_index as u64) < user_account.load()?.borrows.num_positions @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[user_account.load()?.borrows.positions[borrow_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[user_account.load()?.borrows.positions[borrow_index as usize].collateral_index as usize].vault @ CloneError::InvalidInputCollateralAccount,
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
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let borrows = &mut ctx.accounts.user_account.load_mut()?.borrows;

    let pool_index = borrows.positions[borrow_index as usize].pool_index;
    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];
    let collateral =
        token_data.collaterals[borrows.positions[borrow_index as usize].collateral_index as usize];
    let borrow_position = borrows.positions[borrow_index as usize];

    let amount_to_withdraw = amount.min(borrows.positions[borrow_index as usize].collateral_amount);

    // subtract collateral amount from vault supply
    token_data.collaterals[borrows.positions[borrow_index as usize].collateral_index as usize]
        .vault_borrow_supply -= amount_to_withdraw;

    // subtract collateral amount from mint data
    borrows.positions[borrow_index as usize].collateral_amount -= amount_to_withdraw;

    // ensure position sufficiently over collateralized and oracle prices are up to date
    check_mint_collateral_sufficient(
        oracle,
        to_clone_decimal!(borrow_position.borrowed_onasset),
        to_ratio_decimal!(pool.asset_info.stable_collateral_ratio),
        Decimal::new(
            borrows.positions[borrow_index as usize]
                .collateral_amount
                .try_into()
                .unwrap(),
            collateral.scale.try_into().unwrap(),
        ),
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
        amount_to_withdraw,
    )?;

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrows.positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: false,
        collateral_supplied: borrows.positions[borrow_index as usize].collateral_amount,
        collateral_delta: -(amount_to_withdraw as i64),
        collateral_index: borrows.positions[borrow_index as usize]
            .collateral_index
            .try_into()
            .unwrap(),
        borrowed_amount: borrows.positions[borrow_index as usize].borrowed_onasset,
        borrowed_delta: 0
    });
    ctx.accounts.clone.event_counter += 1;

    // check to see if mint is empty, if so remove
    if borrows.positions[borrow_index as usize].collateral_amount == 0 {
        borrows.remove(borrow_index as usize);
    }

    Ok(())
}
