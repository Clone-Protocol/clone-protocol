use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
pub struct InitializeLiquidityPositions<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, User>,
    #[account(zero)]
    pub liquidity_positions: AccountLoader<'info, LiquidityPositions>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeLiquidityPositions>) -> Result<()> {
    let mut liquidity_positions = ctx.accounts.liquidity_positions.load_init()?;

    // set user data
    ctx.accounts.user_account.liquidity_positions =
        *ctx.accounts.liquidity_positions.to_account_info().key;

    // set user as owner
    liquidity_positions.owner = *ctx.accounts.user.to_account_info().key;

    Ok(())
}
