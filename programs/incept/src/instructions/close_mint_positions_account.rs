use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct CloseMintPositionsAccount<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = mint_positions.load()?.owner == *user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        address = user_account.mint_positions
    )]
    pub mint_positions: AccountLoader<'info, MintPositions>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseMintPositionsAccount>, _user_nonce: u8) -> Result<()> {
    let mint_positions = ctx.accounts.mint_positions.load()?;
    return_error_if_false!(
        mint_positions.num_positions == 0,
        InceptError::RequireAllPositionsClosed
    );
    drop(mint_positions);

    ctx.accounts
        .mint_positions
        .close(ctx.accounts.destination.to_account_info())?;
    ctx.accounts.user_account.mint_positions = Pubkey::default();

    Ok(())
}
