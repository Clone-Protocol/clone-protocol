use crate::error::*;
//use crate::instructions::WithdrawCollateralFromComet;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, user_nonce: u8, comet_collateral_index: u8, collateral_amount: u64)]
pub struct WithdrawCollateralFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (comet_collateral_index as u64) < comet.load()?.num_collaterals @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
        constraint = &vault.mint == &token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].mint
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
impl<'a, 'b, 'c, 'info> From<&WithdrawCollateralFromComet<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(
        accounts: &WithdrawCollateralFromComet<'info>,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: accounts.vault.to_account_info().clone(),
            to: accounts
                .user_collateral_token_account
                .to_account_info()
                .clone(),
            authority: accounts.manager.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(
    ctx: Context<WithdrawCollateralFromComet>,
    manager_nonce: u8,
    _user_nonce: u8,
    comet_collateral_index: u8,
    collateral_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let mut close = false;
    {
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_collateral = comet.collaterals[comet_collateral_index as usize];
        let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

        let subtracted_collateral_value = Decimal::new(
            collateral_amount.try_into().unwrap(),
            collateral
                .vault_comet_supply
                .to_decimal()
                .scale()
                .try_into()
                .unwrap(),
        );

        // subtract collateral amount from vault supply
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            RawDecimal::from(
                collateral.vault_comet_supply.to_decimal() - subtracted_collateral_value,
            );

        // ensure the position holds sufficient collateral
        if comet_collateral.collateral_amount.to_decimal() < subtracted_collateral_value {
            return Err(InceptError::InsufficientCollateral.into());
        }

        // update the collateral amount
        comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
            comet_collateral.collateral_amount.to_decimal() - subtracted_collateral_value,
        );

        // remove collateral if empty
        if comet.collaterals[comet_collateral_index as usize]
            .collateral_amount
            .to_decimal()
            .is_zero()
        {
            comet.remove_collateral(comet_collateral_index as usize);
        }

        // send collateral from vault to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::transfer(cpi_ctx, collateral_amount)?;

        // check to see if the comet is empty and should be closed
        if comet.num_collaterals == 0 {
            close = true;
        } else {
            // Require a healthy score after transactions
            let health_score = calculate_health_score(&comet, token_data)?;

            require!(
                matches!(health_score, HealthScore::Healthy { .. }),
                InceptError::HealthScoreTooLow
            );
        }
    }
    if close {
        // close comet account if no collateral remains
        let comet_pubkey = *ctx.accounts.comet.to_account_info().key;
        ctx.accounts
            .comet
            .close(ctx.accounts.user.to_account_info())?;
        if comet_pubkey.eq(&ctx.accounts.user_account.comet) {
            ctx.accounts.user_account.comet = Pubkey::default();
        }
    }

    Ok(())
}
