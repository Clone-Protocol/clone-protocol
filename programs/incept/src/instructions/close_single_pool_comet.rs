//use crate::instructions::CloseSinglePoolComet;
use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(user_nonce: u8, comet_index: u8)]
pub struct CloseSinglePoolComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = &single_pool_comets.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (comet_index as u64) < single_pool_comets.load()?.num_comets @ InceptError::InvalidInputPositionIndex,
    )]
    pub single_pool_comets: AccountLoader<'info, SinglePoolComets>,
    #[account(
        mut,
        constraint = single_pool_comet.load()?.owner == *user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = single_pool_comet.load()?.is_single_pool == 1 @ InceptError::NotSinglePoolComet,
        constraint = single_pool_comet.load()?.num_collaterals == 0 @ InceptError::SinglePoolCometNotEmpty,
        address = single_pool_comets.load()?.comets[comet_index as usize],
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<CloseSinglePoolComet>,
    _user_nonce: u8,
    comet_index: u8,
) -> ProgramResult {
    // remove single pool comet
    ctx.accounts
        .single_pool_comets
        .load_mut()?
        .remove(comet_index as usize);

    let close = ctx.accounts.single_pool_comets.load_mut()?.num_comets == 0;

    // close single pool comet account
    ctx.accounts
        .single_pool_comet
        .close(ctx.accounts.user.to_account_info())?;

    // check to see if single pool comets account should be closed
    if close {
        // close single pool comets account if no comets remain
        ctx.accounts.user_account.single_pool_comets = Pubkey::default();
        ctx.accounts
            .single_pool_comets
            .close(ctx.accounts.user.to_account_info())?;
    }

    Ok(())
}
