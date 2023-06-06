use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use clone::states::Clone;

#[derive(Accounts)]
#[instruction(onusd_amount: u64)]
pub struct OwnerWithdrawal<'info> {
    #[account(address = manager_info.owner)]
    pub manager_owner: Signer<'info>,
    #[account(
        seeds = [b"manager-info", manager_owner.to_account_info().key().as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        address = manager_info.clone
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_owner
    )]
    pub owner_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_info
    )]
    pub manager_onusd_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<OwnerWithdrawal>, onusd_amount: u64) -> Result<()> {
    let manager_info = ctx.accounts.manager_info.clone();
    let manager_seeds = &[&[
        b"manager-info",
        manager_info.owner.as_ref(),
        bytemuck::bytes_of(&manager_info.bump),
    ][..]];

    // Transfer onUSD back to owner
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.manager_onusd_token_account.to_account_info(),
                to: ctx.accounts.owner_onusd_token_account.to_account_info(),
                authority: ctx.accounts.manager_info.to_account_info(),
            },
            manager_seeds,
        ),
        onusd_amount,
    )?;

    Ok(())
}
