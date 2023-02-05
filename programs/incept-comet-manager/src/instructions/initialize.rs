use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::{InitializeComet, InitializeUser};
use incept::program::Incept;
use incept::return_error_if_false;
use incept::states::{Comet, Manager};

pub const PROTOCOL_HEALTH_SCORE_THRESHOLD: u8 = 5;

#[derive(Accounts)]
#[instruction(user_bump: u8, health_score_threshold: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        space = 8 + 163,
        seeds = [b"manager-info", admin.key.as_ref()],
        bump,
        payer = admin
    )]
    pub manager_info: Account<'info, ManagerInfo>,
    /// CHECK: For PDA
    #[account(mut)]
    pub user_account: UncheckedAccount<'info>,
    #[account(zero)]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        address = Pubkey::find_program_address(&[b"manager"], incept_program.to_account_info().key).0
    )]
    pub incept_manager: Box<Account<'info, Manager>>,
    pub incept_program: Program<'info, Incept>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<Initialize>,
    user_bump: u8,
    health_score_threshold: u8,
    withdrawal_fee_bps: u16,
    management_fee_bps: u16,
) -> Result<()> {
    // Set Manager info data.
    return_error_if_false!(
        PROTOCOL_HEALTH_SCORE_THRESHOLD <= health_score_threshold,
        InceptCometManagerError::ThresholdTooLow
    );
    let manager_info = &mut ctx.accounts.manager_info;
    let manager_bump = *ctx.bumps.get("manager_info").unwrap();

    manager_info.incept = ctx.accounts.incept_program.to_account_info().key();
    manager_info.owner = ctx.accounts.admin.to_account_info().key();
    manager_info.membership_token_supply = 0;
    manager_info.user_account = ctx.accounts.user_account.to_account_info().key();
    manager_info.user_bump = user_bump;
    manager_info.bump = manager_bump;
    manager_info.incept_manager = ctx.accounts.incept_manager.to_account_info().key();
    manager_info.health_score_threshold = health_score_threshold;
    manager_info.in_closing_sequence = false;
    manager_info.withdrawal_fee_bps = withdrawal_fee_bps;
    manager_info.management_fee_bps = management_fee_bps;
    manager_info.fee_claim_slot = Clock::get()?.slot;

    // PDA for incept_manager
    let manager_seeds = &[&[
        b"manager-info",
        ctx.accounts.admin.to_account_info().key.as_ref(),
        bytemuck::bytes_of(&manager_bump),
    ][..]];

    // Needs to initialize user account with incept program
    incept::cpi::initialize_user(
        CpiContext::new(
            ctx.accounts.incept_program.to_account_info(),
            InitializeUser {
                user: ctx.accounts.admin.to_account_info(),
                user_account: ctx.accounts.user_account.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        ),
        ctx.accounts.manager_info.to_account_info().key(),
    )?;

    // // Needs to initialize multipool comet account with incept program
    incept::cpi::initialize_comet(
        CpiContext::new_with_signer(
            ctx.accounts.incept_program.to_account_info(),
            InitializeComet {
                user: ctx.accounts.manager_info.to_account_info(),
                user_account: ctx.accounts.user_account.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                comet: ctx.accounts.comet.to_account_info(),
            },
            manager_seeds,
        ),
        user_bump,
        false,
    )?;

    Ok(())
}
