use crate::error::InceptError;
//use crate::instructions::AddCollateralToComet;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, position_index: u8, collateral_amount: u64)]
pub struct AddCollateralToSinglePoolComet<'info> {
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
        constraint = single_pool_comet.load()?.is_single_pool == 1,
        constraint = &single_pool_comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (position_index as u64) < single_pool_comet.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[single_pool_comet.load()?.collaterals[position_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_collateral_token_account.amount >= collateral_amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'a, 'b, 'c, 'info> From<&AddCollateralToSinglePoolComet<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(
        accounts: &AddCollateralToSinglePoolComet<'info>,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: accounts
                .user_collateral_token_account
                .to_account_info()
                .clone(),
            to: accounts.vault.to_account_info().clone(),
            authority: accounts.user.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(
    ctx: Context<AddCollateralToSinglePoolComet>,
    _manager_nonce: u8,
    position_index: u8,
    collateral_amount: u64,
) -> ProgramResult {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut single_pool_comets = ctx.accounts.single_pool_comet.load_mut()?;

    let collateral_index =
        single_pool_comets.collaterals[position_index as usize].collateral_index as usize;

    let collateral: Collateral = token_data.collaterals[collateral_index];
    let current_vault_comet_supply = collateral.vault_comet_supply.to_decimal();
    let collateral_scale: u32 = current_vault_comet_supply.scale().try_into().unwrap();

    let added_collateral_value =
        Decimal::new(collateral_amount.try_into().unwrap(), collateral_scale);

    // add collateral amount to vault supply
    let mut new_vault_comet_supply = current_vault_comet_supply + added_collateral_value;
    new_vault_comet_supply.rescale(collateral_scale);
    token_data.collaterals[collateral_index].vault_comet_supply =
        RawDecimal::from(new_vault_comet_supply);

    let current_collateral_amount = single_pool_comets.collaterals[position_index as usize]
        .collateral_amount
        .to_decimal();
    let mut new_collateral_amount = current_collateral_amount + added_collateral_value;
    new_collateral_amount.rescale(current_collateral_amount.scale());
    single_pool_comets.collaterals[position_index as usize].collateral_amount =
        RawDecimal::from(new_collateral_amount);

    // send collateral from user to vault
    let cpi_ctx = CpiContext::from(&*ctx.accounts);
    token::transfer(cpi_ctx, collateral_amount)?;

    Ok(())
}
