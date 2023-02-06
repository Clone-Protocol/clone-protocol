use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct CloseUserAccount<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseUserAccount>, _user_nonce: u8) -> Result<()> {
    // remove single pool comet
    let user_account = ctx.accounts.user_account.clone();
    assert!(
        user_account.comet == Pubkey::default()
            && user_account.single_pool_comets == Pubkey::default()
            && user_account.mint_positions == Pubkey::default()
            && user_account.liquidity_positions == Pubkey::default()
    );

    ctx.accounts
        .user_account
        .close(ctx.accounts.destination.to_account_info())?;

    Ok(())
}
