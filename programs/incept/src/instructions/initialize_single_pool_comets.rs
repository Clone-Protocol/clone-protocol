//use crate::instructions::InitializeSinglePoolComets;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct InitializeSinglePoolComets<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub single_pool_comets: AccountLoader<'info, SinglePoolComets>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeSinglePoolComets>, _user_nonce: u8) -> Result<()> {
    let mut single_pool_comets = ctx.accounts.single_pool_comets.load_init()?;

    // set user data
    ctx.accounts.user_account.single_pool_comets =
        *ctx.accounts.single_pool_comets.to_account_info().key;

    // set user as owner
    single_pool_comets.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
