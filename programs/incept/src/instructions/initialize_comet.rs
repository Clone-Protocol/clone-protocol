//use crate::instructions::InitializeComet;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct InitializeComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub comet: AccountLoader<'info, Comet>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeComet>, _user_nonce: u8) -> ProgramResult {
    let mut comet = ctx.accounts.comet.load_init()?;

    // set user data
    ctx.accounts.user_account.comet = *ctx.accounts.comet.to_account_info().key;

    // set user as owner
    comet.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
