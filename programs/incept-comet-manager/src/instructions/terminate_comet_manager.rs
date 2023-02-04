use crate::states::*;
use anchor_lang::{prelude::*, AccountsClose};
use anchor_spl::token::{self, *};
use incept::cpi::accounts::WithdrawCollateralFromComet;
use incept::program::Incept;
use incept::states::{Comet, Manager, TokenData, User, USDI_COLLATERAL_INDEX};
use rust_decimal::prelude::*;

#[derive(Accounts)]
pub struct TerminateCometManager<'info> {
    #[account(address = manager_info.owner)]
    pub manager_owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_owner.key.as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.incept_manager
    )]
    pub incept_manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_incept_user: Box<Account<'info, User>>,
    #[account(
        mut,
        address = incept_manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_info.incept
    )]
    pub incept_program: Program<'info, Incept>,
    #[account(
        mut,
        address = manager_incept_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept_manager.token_data,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDI_COLLATERAL_INDEX].vault
    )]
    pub incept_usdi_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = manager_owner
    )]
    pub owner_usdi_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(ctx: Context<TerminateCometManager>) -> Result<()> {
    // Calculate usdi value to withdraw according to tokens redeemed.
    // Withdraw collateral from comet
    let manager_info = &ctx.accounts.manager_info;
    assert!(
        manager_info.in_closing_sequence,
        "Must be in closing sequence!"
    );
    let current_slot = Clock::get()?.slot;
    assert!(
        current_slot >= manager_info.termination_slot,
        "All must be positions closed!"
    );

    let comet = ctx.accounts.comet.load()?;
    let collateral_amount_left = comet.collaterals[0].collateral_amount.to_decimal();
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];

    drop(comet);
    // Withdraw any leftover collateral to manager.
    if collateral_amount_left > Decimal::ZERO {
        incept::cpi::withdraw_collateral_from_comet(
            CpiContext::new_with_signer(
                ctx.accounts.incept_program.to_account_info(),
                WithdrawCollateralFromComet {
                    user: ctx.accounts.manager_info.to_account_info(),
                    user_account: ctx.accounts.manager_incept_user.to_account_info(),
                    manager: ctx.accounts.incept_manager.to_account_info(),
                    token_data: ctx.accounts.token_data.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    comet: ctx.accounts.comet.to_account_info(),
                    vault: ctx.accounts.incept_usdi_vault.to_account_info(),
                    user_collateral_token_account: ctx
                        .accounts
                        .manager_usdi_token_account
                        .to_account_info(),
                },
                manager_seeds,
            ),
            ctx.accounts.incept_manager.bump,
            manager_info.user_bump,
            0,
            collateral_amount_left.mantissa().try_into().unwrap(),
        )?;
    }
    // Transfer USDi to owner.
    ctx.accounts.manager_usdi_token_account.reload()?;
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                from: ctx
                    .accounts
                    .manager_usdi_token_account
                    .to_account_info()
                    .clone(),
                to: ctx
                    .accounts
                    .owner_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager_info.to_account_info().clone(),
            },
            manager_seeds,
        ),
        ctx.accounts.manager_usdi_token_account.amount,
    )?;

    // Close out accounts.
    // TODO: Figure out how to close out these two accounts.
    // May need another instruction created on Incept to do it.
    // ctx.accounts
    //     .comet
    //     .close(ctx.accounts.manager_info.to_account_info())?;
    // ctx.accounts
    //     .manager_incept_user
    //     .close(ctx.accounts.manager_owner.to_account_info())?;
    ctx.accounts
        .manager_info
        .close(ctx.accounts.manager_owner.to_account_info())?;

    Ok(())
}
