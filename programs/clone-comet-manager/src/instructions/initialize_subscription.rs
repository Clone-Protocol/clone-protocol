use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::return_error_if_false;

#[derive(Accounts)]
#[instruction()]
pub struct InitializeSubscription<'info> {
    #[account(mut)]
    pub subscription_owner: Signer<'info>,
    #[account(
        init,
        space = 8 + Subscriber::MAX_SIZE,
        seeds = [b"subscriber", subscription_owner.key.as_ref(), manager_info.to_account_info().key.as_ref()],
        bump,
        payer = subscription_owner
    )]
    pub subscriber: Account<'info, Subscriber>,
    #[account(
        seeds = [b"manager-info", manager_info.owner.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<InitializeSubscription>) -> Result<()> {
    // Set Manager info data.
    return_error_if_false!(
        matches!(ctx.accounts.manager_info.status, CometManagerStatus::Open),
        CloneCometManagerError::OpenStatusRequired
    );

    let subscriber = &mut ctx.accounts.subscriber;
    subscriber.owner = ctx.accounts.subscription_owner.to_account_info().key();
    subscriber.manager = ctx.accounts.manager_info.to_account_info().key();
    subscriber.principal = 0;
    subscriber.membership_tokens = 0;

    Ok(())
}
