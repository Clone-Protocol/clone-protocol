use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
pub struct CloseCometAccount<'info> {
    #[account(address = comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = comet.load()?.is_single_pool == 0 @ CloneError::WrongCometType,
        address = user_account.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseCometAccount>) -> Result<()> {
    let comet = ctx.accounts.comet.load()?;
    let onusd_collateral = comet.collaterals[0];

    return_error_if_false!(
        comet.num_positions == 0
            && comet.num_collaterals == 1
            && onusd_collateral.collateral_amount.to_decimal().is_zero(),
        CloneError::CometNotEmpty
    );
    drop(comet);

    ctx.accounts
        .comet
        .close(ctx.accounts.destination.to_account_info())?;
    ctx.accounts.user_account.comet = Pubkey::default();

    Ok(())
}
