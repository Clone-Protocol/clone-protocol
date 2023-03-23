use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use incept::cpi::accounts::RemoveCometPosition as InceptRemoveCometPosition;
use incept::program::Incept as InceptProgram;
use incept::return_error_if_false;
use incept::states::{Comet, Incept, TokenData, User};

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct RemoveCometPosition<'info> {
    pub signer: Signer<'info>,
    #[account(
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        address = manager_info.incept,
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        address = manager_info.incept_program
    )]
    pub incept_program: Program<'info, InceptProgram>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<RemoveCometPosition>, comet_position_index: u8) -> Result<()> {
    // In normal operation, only the manager can access this instruction.
    // When forcefully closed, anyone can access this operation. When not-forcefully closed
    // this operation shouldn't be needed or used.
    match ctx.accounts.manager_info.status {
        CometManagerStatus::Open => return_error_if_false!(
            ctx.accounts.signer.key() == ctx.accounts.manager_info.owner,
            InceptCometManagerError::OpenStatusRequired
        ),
        CometManagerStatus::Closing {
            forcefully_closed, ..
        } => {
            return_error_if_false!(
                forcefully_closed,
                InceptCometManagerError::MustBeForcefullyClosedManagers
            )
        }
    };
    // Calculate usdi value to withdraw according to tokens redeemed.
    // Withdraw collateral from comet
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];
    incept::cpi::remove_comet_position(
        CpiContext::new_with_signer(
            ctx.accounts.incept_program.to_account_info(),
            InceptRemoveCometPosition {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.manager_incept_user.to_account_info(),
                incept: ctx.accounts.incept.to_account_info(),
                token_data: ctx.accounts.token_data.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
            },
            manager_seeds,
        ),
        comet_position_index,
    )?;

    Ok(())
}
