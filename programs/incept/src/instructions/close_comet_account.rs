use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

#[derive(Accounts)]
#[instruction(user_nonce: u8)]
pub struct CloseCometAccount<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = comet.load()?.owner == *user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.is_single_pool == 0 @ InceptError::WrongCometType,
        address = user_account.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    /// CHECK: Should be a system owned address.
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<CloseCometAccount>, _user_nonce: u8) -> Result<()> {
    let comet = ctx.accounts.comet.load()?;
    let usdi_collateral = comet.collaterals[0];

    return_error_if_false!(
        comet.num_positions == 0
            && comet.num_collaterals == 1
            && usdi_collateral.collateral_amount.to_decimal().is_zero(),
        InceptError::CometNotEmpty
    );
    drop(comet);

    ctx.accounts
        .comet
        .close(ctx.accounts.destination.to_account_info())?;
    ctx.accounts.user_account.comet = Pubkey::default();

    Ok(())
}
