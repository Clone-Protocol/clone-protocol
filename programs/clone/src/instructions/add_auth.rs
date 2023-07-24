use crate::error::*;
use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(auth: Pubkey)]
pub struct AddAuth<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump
    )]
    pub clone: Account<'info, Clone>,
}

pub fn execute(ctx: Context<AddAuth>, auth: Pubkey) -> Result<()> {
    let clone = &mut ctx.accounts.clone;

    if let Some(empty_slot) = clone
        .auth
        .iter_mut()
        .find(|slot| **slot == Pubkey::default())
    {
        *empty_slot = auth;
    } else {
        return Err(error!(CloneError::AuthArrayFull));
    }

    Ok(())
}
