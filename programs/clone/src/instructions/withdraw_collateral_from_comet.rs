use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

#[derive(Accounts)]
#[instruction(collateral_amount: u64)]
pub struct WithdrawCollateralFromComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
    #[account(
        mut,
        address = clone.collateral.vault
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

pub fn execute(ctx: Context<WithdrawCollateralFromComet>, collateral_amount: u64) -> Result<()> {
    return_error_if_false!(collateral_amount > 0, CloneError::InvalidTokenAmount);

    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let collateral = &ctx.accounts.clone.collateral;
    let pools = &mut ctx.accounts.pools;
    let oracles = &ctx.accounts.oracles;

    let comet = &mut ctx.accounts.user_account.comet;
    let collateral_to_withdraw = collateral_amount.min(comet.collateral_amount);

    // update the collateral amount
    comet.collateral_amount = comet
        .collateral_amount
        .checked_sub(collateral_to_withdraw)
        .unwrap();

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
    let health_score = calculate_health_score(comet, pools, oracles, collateral)?;

    return_error_if_false!(health_score.is_healthy(), CloneError::HealthScoreTooLow);

    Ok(())
}
