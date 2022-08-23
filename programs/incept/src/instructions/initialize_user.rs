////use crate::instructions::InitializeUser;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct InitializeUser<'info> {
    pub user: Signer<'info>,
    #[account(
        init,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
        payer = user
    )]
    pub user_account: Account<'info, User>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeUser>, _user_nonce: u8) -> ProgramResult {
    // set user authority
    ctx.accounts.user_account.authority = *ctx.accounts.user.to_account_info().key;
    Ok(())
}
