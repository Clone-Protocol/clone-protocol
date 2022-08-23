use crate::instructions::InitializeUser;
use anchor_lang::prelude::*;

pub fn execute(ctx: Context<InitializeUser>, _user_nonce: u8) -> ProgramResult {
    // set user authority
    ctx.accounts.user_account.authority = *ctx.accounts.user.to_account_info().key;
    Ok(())
}
