use crate::error::InceptError;
//use crate::instructions::AddCollateralToComet;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, collateral_index: u8, collateral_amount: u64)]
pub struct AddCollateralToComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager,
        constraint = (collateral_index as u64) < token_data.load()?.num_collaterals @ InceptError::InvalidInputPositionIndex
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[collateral_index as usize].vault,
        constraint = &vault.mint == &token_data.load()?.collaterals[collateral_index as usize].mint
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
impl<'a, 'b, 'c, 'info> From<&AddCollateralToComet<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(
        accounts: &AddCollateralToComet<'info>,
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
    ctx: Context<AddCollateralToComet>,
    _manager_nonce: u8,
    collateral_index: u8,
    collateral_amount: u64,
) -> ProgramResult {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let collateral = token_data.collaterals[collateral_index as usize];

    let added_collateral_value = Decimal::new(
        collateral_amount.try_into().unwrap(),
        collateral
            .vault_comet_supply
            .to_decimal()
            .scale()
            .try_into()
            .unwrap(),
    );

    // add collateral amount to vault supply
    token_data.collaterals[collateral_index as usize].vault_comet_supply =
        RawDecimal::from(collateral.vault_comet_supply.to_decimal() + added_collateral_value);

    // find the comet collateral index
    let comet_collateral_index = comet.get_collateral_index(collateral_index);

    // check to see if a new collateral must be added to the position
    if comet_collateral_index == usize::MAX {
        if comet.is_single_pool == 1 {
            return Err(InceptError::AttemptedToAddNewCollateralToSingleComet.into());
        }
        comet.add_collateral(CometCollateral {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: RawDecimal::from(added_collateral_value),
            collateral_index: collateral_index.into(),
        });
    } else {
        comet.collaterals[comet_collateral_index].collateral_amount = RawDecimal::from(
            comet.collaterals[comet_collateral_index]
                .collateral_amount
                .to_decimal()
                + added_collateral_value,
        );
    }

    // send collateral from user to vault
    let cpi_ctx = CpiContext::from(&*ctx.accounts);
    token::transfer(cpi_ctx, collateral_amount)?;

    Ok(())
}
