use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

#[derive(Accounts)]
#[instruction(comet_collateral_index: u8, collateral_amount: u64)]
pub struct WithdrawCollateralFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
        constraint = (comet_collateral_index as u64) < user_account.load()?.comet.num_collaterals @ CloneError::InvalidInputPositionIndex
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
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[user_account.load()?.comet.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
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
    ctx: Context<WithdrawCollateralFromComet>,
    comet_collateral_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let comet_collateral_index = comet_collateral_index as usize;

    let comet = &mut ctx.accounts.user_account.load_mut()?.comet;
    let comet_collateral = comet.collaterals[comet_collateral_index];

    let collateral_to_withdraw =
        collateral_amount.min(comet.collaterals[comet_collateral_index].collateral_amount);

    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply -=
        collateral_to_withdraw;

    // update the collateral amount
    comet.collaterals[comet_collateral_index].collateral_amount -= collateral_to_withdraw;

    // remove collateral if empty
    if comet.collaterals[comet_collateral_index].collateral_amount == 0 {
        comet.remove_collateral(comet_collateral_index);
    }

    // send collateral from vault to user
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
        collateral_to_withdraw,
    )?;
    let health_score = calculate_health_score(&comet, token_data)?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    Ok(())
}
