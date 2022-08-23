use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

//use crate::instructions::PayBackiAssetToMint;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, mint_index: u8, amount: u64)]
pub struct PayBackiAssetToMint<'info> {
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
        constraint = user_iasset_token_account.amount >= amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = iasset_mint,
        associated_token::authority = user
    )]
    pub user_iasset_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = &mint_positions.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (mint_index as u64) < mint_positions.load()?.num_positions @ InceptError::InvalidInputPositionIndex,
        constraint = mint_positions.load()?.mint_positions[mint_index as usize].borrowed_iasset.to_u64() >= amount @ InceptError::InequalityComparisonViolated
    )]
    pub mint_positions: AccountLoader<'info, MintPositions>,
    #[account(
        mut,
        address = token_data.load()?.pools[mint_positions.load()?.mint_positions[mint_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}
impl<'a, 'b, 'c, 'info> From<&PayBackiAssetToMint<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Burn<'info>>
{
    fn from(accounts: &PayBackiAssetToMint<'info>) -> CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: accounts.iasset_mint.to_account_info().clone(),
            to: accounts.user_iasset_token_account.to_account_info().clone(),
            authority: accounts.user.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(
    ctx: Context<PayBackiAssetToMint>,
    _manager_nonce: u8,
    mint_index: u8,
    amount: u64,
) -> ProgramResult {
    let amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;
    let mint_position = mint_positions.mint_positions[mint_index as usize];

    // burn user iasset to pay back mint position
    let cpi_ctx_burn: CpiContext<Burn> = CpiContext::from(&*ctx.accounts);
    token::burn(cpi_ctx_burn, amount)?;

    // update total amount of borrowed iasset
    let updated_borrowed_iasset = mint_position.borrowed_iasset.to_decimal() - amount_value;
    mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
        RawDecimal::from(updated_borrowed_iasset);

    Ok(())
}
