use crate::error::CloneError;
//use crate::instructions::AddCollateralToComet;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(collateral_index: u8, collateral_amount: u64)]
pub struct AddCollateralToComet<'info> {
    #[account(address = comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone,
        constraint = (collateral_index as u64) < token_data.load()?.num_collaterals @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.collaterals[collateral_index as usize].status == Status::Active as u64 @ CloneError::PoolStatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.comet,
        constraint = &comet.load()?.owner == user.to_account_info().key @ CloneError::InvalidAccountLoaderOwner,
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[collateral_index as usize].vault,
        constraint = vault.mint == token_data.load()?.collaterals[collateral_index as usize].mint
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_collateral_token_account.amount >= collateral_amount @ CloneError::InvalidTokenAccountBalance,
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
    collateral_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let collateral = token_data.collaterals[collateral_index as usize];
    let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();

    let user_collateral_in_account = Decimal::new(
        ctx.accounts
            .user_collateral_token_account
            .amount
            .try_into()
            .unwrap(),
        collateral_scale,
    );

    let added_collateral_value =
        Decimal::new(collateral_amount.try_into().unwrap(), collateral_scale)
            .min(user_collateral_in_account);

    let current_vault_comet_supply = collateral.vault_comet_supply.to_decimal();
    let new_vault_comet_supply = rescale_toward_zero(
        current_vault_comet_supply + added_collateral_value,
        current_vault_comet_supply.scale(),
    );
    // add collateral amount to vault supply
    token_data.collaterals[collateral_index as usize].vault_comet_supply =
        RawDecimal::from(new_vault_comet_supply);

    // find the comet collateral index
    let mut comet_collateral_index: Option<usize> = None;
    for (i, collateral) in comet.collaterals[..comet.num_collaterals as usize]
        .iter()
        .enumerate()
    {
        if collateral.collateral_index == collateral_index as u64 {
            comet_collateral_index = Some(i);
            break;
        }
    }

    // check to see if a new collateral must be added to the position
    if let Some(index) = comet_collateral_index {
        comet.collaterals[index].collateral_amount = RawDecimal::from(
            comet.collaterals[index].collateral_amount.to_decimal() + added_collateral_value,
        );
    } else {
        comet.add_collateral(CometCollateral {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: RawDecimal::from(added_collateral_value),
            collateral_index: collateral_index.into(),
        });
    }

    // send collateral from user to vault
    let cpi_ctx = CpiContext::from(&*ctx.accounts);
    token::transfer(cpi_ctx, collateral_amount)?;

    Ok(())
}
