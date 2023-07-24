use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(borrow_index: u8, amount: u64)]
pub struct PayBorrowDebt<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (borrow_index as u64) < user_account.borrows.num_positions @ CloneError::InvalidInputPositionIndex,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[user_account.borrows.positions[borrow_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = user_onasset_token_account.amount >= amount @ CloneError::InvalidTokenAccountBalance,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = token_data.load()?.pools[user_account.borrows.positions[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}
impl<'a, 'b, 'c, 'info> From<&PayBorrowDebt<'info>> for CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
    fn from(accounts: &PayBorrowDebt<'info>) -> CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: accounts.onasset_mint.to_account_info().clone(),
            from: accounts
                .user_onasset_token_account
                .to_account_info()
                .clone(),
            authority: accounts.user.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(ctx: Context<PayBorrowDebt>, borrow_index: u8, amount: u64) -> Result<()> {
    let mut amount_value = Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE);

    let mut token_data = ctx.accounts.token_data.load_mut()?;

    let borrows = &mut ctx.accounts.user_account.borrows;
    let borrow_position = borrows.positions[borrow_index as usize];

    amount_value = amount_value.min(borrow_position.borrowed_onasset.to_decimal());

    // burn user onasset to pay back mint position
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        amount_value.mantissa().try_into().unwrap(),
    )?;

    // update total amount of borrowed onasset
    let updated_borrowed_onasset = rescale_toward_zero(
        borrow_position.borrowed_onasset.to_decimal() - amount_value,
        CLONE_TOKEN_SCALE,
    );
    borrows.positions[borrow_index as usize].borrowed_onasset =
        RawDecimal::from(updated_borrowed_onasset);

    let new_minted_amount = rescale_toward_zero(
        token_data.pools[borrow_position.pool_index as usize]
            .total_minted_amount
            .to_decimal()
            - amount_value,
        CLONE_TOKEN_SCALE,
    );
    token_data.pools[borrow_position.pool_index as usize].total_minted_amount =
        RawDecimal::from(new_minted_amount);

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index: borrows.positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: false,
        collateral_supplied: borrows.positions[borrow_index as usize]
            .collateral_amount
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        collateral_delta: 0,
        collateral_index: borrows.positions[borrow_index as usize]
            .collateral_index
            .try_into()
            .unwrap(),
        borrowed_amount: borrows.positions[borrow_index as usize]
            .borrowed_onasset
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        borrowed_delta: -amount_value.mantissa() as i64
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
