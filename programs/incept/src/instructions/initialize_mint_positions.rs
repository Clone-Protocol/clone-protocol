//use crate::instructions::InitializeMintPositions;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct InitializeMintPositions<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub mint_positions: AccountLoader<'info, MintPositions>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeMintPositions>, _user_nonce: u8) -> ProgramResult {
    let mut mint_positions = ctx.accounts.mint_positions.load_init()?;

    // set user data
    ctx.accounts.user_account.mint_positions = *ctx.accounts.mint_positions.to_account_info().key;

    // set user as owner
    mint_positions.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
