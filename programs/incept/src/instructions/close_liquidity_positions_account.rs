use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct CloseLiquidityPositionsAccount<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = liquidity_positions.load()?.owner == *user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        address = user_account.liquidity_positions
    )]
    pub liquidity_positions: AccountLoader<'info, LiquidityPositions>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseLiquidityPositionsAccount>, _user_nonce: u8) -> Result<()> {
    let liquidity_positions = ctx.accounts.liquidity_positions.load()?;
    return_error_if_false!(
        liquidity_positions.num_positions == 0,
        InceptError::RequireAllPositionsClosed
    );
    drop(liquidity_positions);

    ctx.accounts
        .liquidity_positions
        .close(ctx.accounts.destination.to_account_info())?;
    ctx.accounts.user_account.liquidity_positions = Pubkey::default();

    Ok(())
}
