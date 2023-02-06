use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct CloseSinglePoolCometAccount<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = single_pool_comet.load()?.owner == *user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = single_pool_comet.load()?.is_single_pool == 1 @ InceptError::WrongCometType,
        address = user_account.single_pool_comets
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseSinglePoolCometAccount>, _user_nonce: u8) -> Result<()> {
    let single_pool_comet = ctx.accounts.single_pool_comet.load()?;
    return_error_if_false!(
        single_pool_comet.num_positions == 0 && single_pool_comet.num_collaterals == 0,
        InceptError::CometNotEmpty
    );
    drop(single_pool_comet);

    ctx.accounts
        .single_pool_comet
        .close(ctx.accounts.destination.to_account_info())?;
    ctx.accounts.user_account.single_pool_comets = Pubkey::default();

    Ok(())
}
