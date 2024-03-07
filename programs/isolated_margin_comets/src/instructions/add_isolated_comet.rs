use crate::initialize::MANAGER_SEED;
use crate::states::*;
use anchor_lang::prelude::*;
use clone::instructions::USER_SEED;
use clone::{program::Clone, states::User};

// This instruction checks that the unique_seed used to generate the owner_account
// is correct and is the owner of the comet. If so, it adds the unique_seed to the
// manager_account's account_seeds if not already present.

#[derive(Accounts)]
#[instruction(unique_seed: u8)]
pub struct AddIsolatedComet<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [MANAGER_SEED.as_ref(), signer.key.as_ref()],
        bump,
    )]
    pub manager_account: Account<'info, PositionManager>,
    #[account(
        init,
        space = 8, // 24 + 16
        seeds = [&[unique_seed], manager_account.to_account_info().key.as_ref()],
        bump,
        payer = signer,
    )]
    pub owner_account: Account<'info, CometOwner>,
    #[account(
        seeds = [USER_SEED.as_ref(), owner_account.to_account_info().key.as_ref()],
        bump,
        seeds::program = clone_program.key(),
    )]
    pub user_account: Account<'info, User>,
    pub clone_program: Program<'info, Clone>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<AddIsolatedComet>, unique_seed: u8) -> Result<()> {
    // Need to check that seed is not already present in Vec<PositionManager>
    let position_manager = &mut ctx.accounts.manager_account;
    assert!(!position_manager.account_seeds.contains(&unique_seed));
    position_manager.account_seeds.push(unique_seed);
    Ok(())
}
