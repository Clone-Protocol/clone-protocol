use crate::events::*;
use crate::states::*;
use crate::{CLONE_STAKING_SEED, USER_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(user: Pubkey, vesting: UserVestingInfo)]
pub struct UpdateUserVesting<'info> {
    #[account(mut, address = clone_staking.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump = clone_staking.bump,
    )]
    pub clone_staking: Account<'info, CloneStaking>,
}

pub fn execute(
    ctx: Context<UpdateUserVesting>,
    user: Pubkey,
    vesting: UserVestingInfo,
) -> Result<()> {
    // Initialize user account if needed.
    let user_account = &mut ctx.accounts.user_account;
    user_account.vesting = vesting;

    let current_slot = Clock::get()?.slot;

    emit!(StakingEvent {
        user_address: user,
        amount: user_account.staked_tokens,
        previous_amount: user_account.staked_tokens,
        slot: current_slot,
        min_slot_withdrawal: user_account.min_slot_withdrawal,
        vesting_allocation_amount: user_account.vesting.allocation_amount,
        vesting_amount_withdrawn: user_account.vesting.amount_withdrawn,
        vesting_start_slot: user_account.vesting.starting_slot,
        vesting_end_slot: user_account.vesting.ending_slot,
    });

    Ok(())
}
