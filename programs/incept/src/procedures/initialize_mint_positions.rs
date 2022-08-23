use crate::instructions::InitializeMintPositions;
use anchor_lang::prelude::*;

pub fn execute(ctx: Context<InitializeMintPositions>, _user_nonce: u8) -> ProgramResult {
    let mut mint_positions = ctx.accounts.mint_positions.load_init()?;

    // set user data
    ctx.accounts.user_account.mint_positions = *ctx.accounts.mint_positions.to_account_info().key;

    // set user as owner
    mint_positions.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
