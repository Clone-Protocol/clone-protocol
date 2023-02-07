//use crate::instructions::InitializeMintPositions;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
pub struct InitializeMintPositions<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub mint_positions: AccountLoader<'info, MintPositions>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeMintPositions>) -> Result<()> {
    let mut mint_positions = ctx.accounts.mint_positions.load_init()?;

    // set user data
    ctx.accounts.user_account.mint_positions = *ctx.accounts.mint_positions.to_account_info().key;

    // set user as owner
    mint_positions.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
