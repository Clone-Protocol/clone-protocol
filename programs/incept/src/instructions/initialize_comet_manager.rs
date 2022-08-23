use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
//use crate::instructions::InitializeCometManager;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, user_nonce: u8)]
pub struct InitializeCometManager<'info> {
    pub user: Signer<'info>,
    #[account(address = manager.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = admin
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(zero)]
    pub comet_manager: AccountLoader<'info, Comet>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = manager,
        payer = user
    )]
    pub membership_token_mint: Box<Account<'info, Mint>>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializeCometManager>,
    _manager_nonce: u8,
    _user_nonce: u8,
) -> ProgramResult {
    let mut comet_manager = ctx.accounts.comet_manager.load_init()?;

    // set user data
    ctx.accounts.user_account.is_manager = 1;
    ctx.accounts.user_account.comet_manager.comet =
        *ctx.accounts.comet_manager.to_account_info().key;
    ctx.accounts
        .user_account
        .comet_manager
        .membership_token_mint = *ctx.accounts.membership_token_mint.to_account_info().key;

    // set comet manager data
    comet_manager.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
