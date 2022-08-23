use anchor_lang::prelude::*;

use crate::instructions::InitializeCometManager;

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
