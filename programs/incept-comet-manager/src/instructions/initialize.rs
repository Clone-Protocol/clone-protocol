use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use incept::cpi::accounts::{InitializeComet, InitializeUser};
use incept::program::Incept as InceptProgram;
use incept::states::{Comet, Incept};

#[derive(Accounts)]
#[instruction(user_bump: u8, withdrawal_fee_bps: u16, management_fee_bps: u16)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        space = 8 + ManagerInfo::MAX_SIZE,
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
        address = Pubkey::find_program_address(&[b"incept"], incept_program.to_account_info().key).0
    )]
    pub incept: Box<Account<'info, Incept>>,
    pub incept_program: Program<'info, InceptProgram>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<Initialize>,
    user_bump: u8,
    withdrawal_fee_bps: u16,
    management_fee_bps: u16,
) -> Result<()> {
    // Set Manager info data.
    let manager_info = &mut ctx.accounts.manager_info;
    let manager_bump = *ctx.bumps.get("manager_info").unwrap();

    manager_info.incept_program = ctx.accounts.incept_program.to_account_info().key();
    manager_info.owner = ctx.accounts.admin.to_account_info().key();
    manager_info.membership_token_supply = 0;
    manager_info.user_account = ctx.accounts.user_account.to_account_info().key();
    manager_info.user_bump = user_bump;
    manager_info.bump = manager_bump;
    manager_info.incept = ctx.accounts.incept.to_account_info().key();
    manager_info.status = CometManagerStatus::Open;
    manager_info.withdrawal_fee_bps = withdrawal_fee_bps;
    manager_info.management_fee_bps = management_fee_bps;
    manager_info.fee_claim_slot = Clock::get()?.slot;

    // PDA for incept
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
        false,
    )?;

    Ok(())
}
