use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

pub const CLONE_STAKING_SEED: &str = "clone-staking";

#[derive(Accounts)]
#[instruction(
    staking_period_slots: u64,
)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        space = 496 + 8,
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump,
        payer = admin
    )]
    pub clone_staking: Account<'info, CloneStaking>,
    /// CHECK: Admin responsibility
    pub cln_token_mint: Account<'info, Mint>,
    #[account(
        token::mint = cln_token_mint,
        token::authority = clone_staking,
    )]
    pub cln_token_vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<Initialize>, staking_period_slots: u64) -> Result<()> {
    let clone_staking = &mut ctx.accounts.clone_staking;
    clone_staking.admin = ctx.accounts.admin.key();
    clone_staking.cln_token_mint = ctx.accounts.cln_token_mint.key();
    clone_staking.cln_token_vault = ctx.accounts.cln_token_vault.key();
    clone_staking.staking_period_slots = staking_period_slots;
    clone_staking.bump = *ctx
        .bumps
        .get("clone_staking")
        .ok_or(error!(CloneStakingError::BumpNotFound))?;
    clone_staking.tiers = [Tier::default(); MAX_TIERS];

    Ok(())
}
