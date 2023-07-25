use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, borrow_index: u8, amount: u64)]
pub struct PayBorrowDebt<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
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
        address = user_account.borrow_positions,
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ CloneError::InvalidInputPositionIndex,
    )]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    #[account(
        mut,
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].asset_info.onasset_mint,
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
            authority: accounts.payer.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(
    ctx: Context<PayBorrowDebt>,
    user: Pubkey,
    borrow_index: u8,
    amount: u64,
) -> Result<()> {
    let mut amount_value = Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE);

    let mut token_data = ctx.accounts.token_data.load_mut()?;

    let borrow_positions = &mut ctx.accounts.borrow_positions.load_mut()?;
    let mint_position = borrow_positions.borrow_positions[borrow_index as usize];

    amount_value = amount_value.min(mint_position.borrowed_onasset.to_decimal());

    // burn user onasset to pay back mint position
    let cpi_accounts = Burn {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.payer.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        amount_value.mantissa().try_into().unwrap(),
    )?;

    // update total amount of borrowed onasset
    let updated_borrowed_onasset = rescale_toward_zero(
        mint_position.borrowed_onasset.to_decimal() - amount_value,
        CLONE_TOKEN_SCALE,
    );
    borrow_positions.borrow_positions[borrow_index as usize].borrowed_onasset =
        RawDecimal::from(updated_borrowed_onasset);

    let new_minted_amount = rescale_toward_zero(
        token_data.pools[mint_position.pool_index as usize]
            .total_minted_amount
            .to_decimal()
            - amount_value,
        CLONE_TOKEN_SCALE,
    );
    token_data.pools[mint_position.pool_index as usize].total_minted_amount =
        RawDecimal::from(new_minted_amount);

    emit!(BorrowUpdate {
        event_id: ctx.accounts.clone.event_counter,
        user_address: user,
        pool_index: borrow_positions.borrow_positions[borrow_index as usize]
            .pool_index
            .try_into()
            .unwrap(),
        is_liquidation: false,
        collateral_supplied: borrow_positions.borrow_positions[borrow_index as usize]
            .collateral_amount
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        collateral_delta: 0,
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
        borrowed_delta: -amount_value.mantissa() as i64
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
