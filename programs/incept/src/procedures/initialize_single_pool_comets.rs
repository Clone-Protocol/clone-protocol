use crate::instructions::InitializeSinglePoolComets;
use anchor_lang::prelude::*;

pub fn execute(ctx: Context<InitializeSinglePoolComets>, _user_nonce: u8) -> ProgramResult {
    let mut single_pool_comets = ctx.accounts.single_pool_comets.load_init()?;

    // set user data
    ctx.accounts.user_account.single_pool_comets =
        *ctx.accounts.single_pool_comets.to_account_info().key;

    // set user as owner
    single_pool_comets.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
