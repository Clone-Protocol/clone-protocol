use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction( borrow_index: u8, amount: u64)]
pub struct SubtractiAssetFromBorrow<'info> {
    #[account(address = borrow_positions.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        mut,
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
        constraint = user_iasset_token_account.amount >= amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = iasset_mint,
        associated_token::authority = user
    )]
    pub user_iasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = user_account.borrow_positions,
        constraint = (borrow_index as u64) < borrow_positions.load()?.num_positions @ InceptError::InvalidInputPositionIndex,
    )]
    pub borrow_positions: AccountLoader<'info, BorrowPositions>,
    #[account(
        mut,
        address = token_data.load()?.pools[borrow_positions.load()?.borrow_positions[borrow_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}
impl<'a, 'b, 'c, 'info> From<&SubtractiAssetFromBorrow<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Burn<'info>>
{
    fn from(
        accounts: &SubtractiAssetFromBorrow<'info>,
    ) -> CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: accounts.iasset_mint.to_account_info().clone(),
            from: accounts.user_iasset_token_account.to_account_info().clone(),
            authority: accounts.user.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(
    ctx: Context<SubtractiAssetFromBorrow>,
    borrow_index: u8,
    amount: u64,
) -> Result<()> {
    let mut amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let mut token_data = ctx.accounts.token_data.load_mut()?;

    let borrow_positions = &mut ctx.accounts.borrow_positions.load_mut()?;
    let mint_position = borrow_positions.borrow_positions[borrow_index as usize];

    amount_value = amount_value.min(mint_position.borrowed_iasset.to_decimal());

    // burn user iasset to pay back mint position
    let cpi_accounts = Burn {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        amount_value.mantissa().try_into().unwrap(),
    )?;

    // update total amount of borrowed iasset
    let updated_borrowed_iasset = mint_position.borrowed_iasset.to_decimal() - amount_value;
    borrow_positions.borrow_positions[borrow_index as usize].borrowed_iasset =
        RawDecimal::from(updated_borrowed_iasset);

    let new_minted_amount = rescale_toward_zero(
        token_data.pools[mint_position.pool_index as usize]
            .total_minted_amount
            .to_decimal()
            - amount_value,
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[mint_position.pool_index as usize].total_minted_amount =
        RawDecimal::from(new_minted_amount);

    Ok(())
}
