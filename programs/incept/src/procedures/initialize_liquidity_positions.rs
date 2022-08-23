use crate::instructions::InitializeLiquidityPositions;
use anchor_lang::prelude::*;

pub fn execute(ctx: Context<InitializeLiquidityPositions>, _user_nonce: u8) -> ProgramResult {
    let mut liquidity_positions = ctx.accounts.liquidity_positions.load_init()?;

    // set user data
    ctx.accounts.user_account.liquidity_positions =
        *ctx.accounts.liquidity_positions.to_account_info().key;

    // set user as owner
    liquidity_positions.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
