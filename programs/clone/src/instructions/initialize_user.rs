////use crate::instructions::InitializeUser;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Token;

pub const USER_SEED: &str = "user";

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = 8 + 5144,
        seeds = [USER_SEED.as_ref(), authority.as_ref()],
        bump,
        payer = payer
    )]
    pub user_account: Box<Account<'info, User>>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(_ctx: Context<InitializeUser>, _authority: Pubkey) -> Result<()> {
    Ok(())
}
