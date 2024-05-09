use crate::error::*;
use crate::events::*;
use crate::states::*;
use crate::CLONE_STAKING_SEED;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

pub const USER_SEED: &str = "user";

#[derive(Accounts)]
#[instruction(user: Pubkey, amount: u64)]
pub struct AddStake<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 8 + 16,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump,
        payer = payer
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump = clone_staking.bump,
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
        token::authority = payer,
    )]
    pub payer_cln_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<AddStake>,
    user: Pubkey,
    amount: u64,
    vesting_meta: Option<VestingMeta>,
) -> Result<()> {
    // Initialize user account if needed.
    let user_account = &mut ctx.accounts.user_account;
    let is_admin_signer = ctx
        .accounts
        .payer
        .key()
        .eq(&ctx.accounts.clone_staking.admin);

    if is_admin_signer {
        if let Some(meta) = vesting_meta {
            user_account.vesting = meta;
        }
    }

    let clone_staking = &ctx.accounts.clone_staking;
    let current_slot = Clock::get()?.slot;
    let previous_amount = user_account.staked_tokens;

    if amount > 0 {
        // Transfer cln from payer to vault
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .payer_cln_token_account
                .to_account_info()
                .clone(),
            to: ctx.accounts.cln_token_vault.to_account_info().clone(),
            authority: ctx.accounts.payer.to_account_info().clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();

        transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        // Update user account
        user_account.staked_tokens = user_account
            .staked_tokens
            .checked_add(amount)
            .ok_or(error!(CloneStakingError::CheckedMathError))?;

        user_account.min_slot_withdrawal = current_slot
            .checked_add(clone_staking.staking_period_slots)
            .ok_or(error!(CloneStakingError::CheckedMathError))?;
    }

    emit!(StakingEvent {
        user_address: user,
        amount: user_account.staked_tokens,
        previous_amount,
        slot: current_slot,
        min_slot_withdrawal: user_account.min_slot_withdrawal,
        vesting_allocation_amount: user_account.vesting.allocation_amount,
        vesting_amount_withdrawn: user_account.vesting.amount_withdrawn
    });

    Ok(())
}
