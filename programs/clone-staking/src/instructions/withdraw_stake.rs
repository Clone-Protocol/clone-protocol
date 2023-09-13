use crate::error::*;
use crate::states::*;
use crate::{CLONE_STAKING_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawStake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump,
        has_one = cln_token_mint,
        has_one = cln_token_vault,

    )]
    pub clone_staking: Account<'info, CloneStaking>,
    #[account(address = clone_staking.cln_token_mint)]
    pub cln_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        address = clone_staking.cln_token_vault
    )]
    pub cln_token_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = cln_token_mint,
        token::authority = user,
    )]
    pub user_cln_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<WithdrawStake>, amount: u64) -> Result<()> {
    let current_slot = Clock::get()?.slot;
    let user_account = &mut ctx.accounts.user_account;
    let clone_staking = &ctx.accounts.clone_staking;

    require!(
        current_slot >= user_account.min_slot_withdrawal,
        CloneStakingError::CannotWithdrawBeforeStakingPeriod
    );
    require!(
        amount > 0 && amount <= user_account.staked_tokens,
        CloneStakingError::InvalidInput
    );

    let seeds = &[&[
        CLONE_STAKING_SEED.as_ref(),
        bytemuck::bytes_of(&clone_staking.bump),
    ][..]];
    // Transfer cln from vault to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.cln_token_vault.to_account_info().clone(),
        to: ctx
            .accounts
            .user_cln_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone_staking.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();

    transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
        amount,
    )?;
    // Update user account
    user_account.staked_tokens = user_account.staked_tokens.checked_sub(amount).unwrap();

    Ok(())
}
