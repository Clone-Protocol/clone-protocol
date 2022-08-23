use crate::instructions::InitializeComet;
use anchor_lang::prelude::*;

pub fn execute(ctx: Context<InitializeComet>, _user_nonce: u8) -> ProgramResult {
    let mut comet = ctx.accounts.comet.load_init()?;

    // set user data
    ctx.accounts.user_account.comet = *ctx.accounts.comet.to_account_info().key;

    // set user as owner
    comet.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
