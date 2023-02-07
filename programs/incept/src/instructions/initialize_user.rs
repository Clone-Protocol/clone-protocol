////use crate::instructions::InitializeUser;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        space = 8 + 161,
        seeds = [b"user", authority.as_ref()],
        bump,
        payer = user
    )]
    pub user_account: Account<'info, User>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeUser>, authority: Pubkey) -> Result<()> {
    // set user authority
    let bump = *ctx.bumps.get("user_account").unwrap();
    ctx.accounts.user_account.authority = authority;
    ctx.accounts.user_account.bump = bump;
    Ok(())
}
