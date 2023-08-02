use crate::error::CloneError;
use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

#[derive(Accounts)]
#[instruction(collateral_index: u8, collateral_amount: u64)]
pub struct AddCollateralToComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.key.as_ref()],
        bump,
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = (collateral_index as u64) < token_data.load()?.num_collaterals @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.collaterals[collateral_index as usize].status == Status::Active as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_collateral_token_account.amount >= collateral_amount @ CloneError::InvalidTokenAccountBalance,
        associated_token::mint = vault.mint,
        associated_token::authority = user
    )]
    pub user_collateral_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<AddCollateralToComet>,
    collateral_index: u8,
    collateral_amount: u64,
) -> Result<()> {
    let comet = &mut ctx.accounts.user_account.load_mut()?.comet;

    // find the comet collateral index
    let comet_collateral_info = comet.collaterals[..comet.num_collaterals as usize]
        .iter()
        .enumerate()
        .find(|(_, comet_collateral)| comet_collateral.collateral_index == collateral_index as u64);

    // check to see if a new collateral must be added to the position
    if let Some((index, _)) = comet_collateral_info {
        comet.collaterals[index].collateral_amount += collateral_amount;
    } else {
        comet.add_collateral(CometCollateral {
            collateral_amount,
            collateral_index: collateral_index.into(),
        });
    }

    // send collateral from user to vault
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .user_collateral_token_account
            .to_account_info()
            .clone(),
        to: ctx.accounts.vault.to_account_info().clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new(cpi_program, cpi_accounts),
        collateral_amount,
    )?;

    Ok(())
}
