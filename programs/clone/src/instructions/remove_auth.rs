use crate::error::*;
use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(auth: Pubkey)]
pub struct RemoveAuth<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump
    )]
    pub clone: Account<'info, Clone>,
}

pub fn execute(ctx: Context<RemoveAuth>, auth: Pubkey) -> Result<()> {
    let clone = &mut ctx.accounts.clone;

    if let Some(auth_slot) = clone.auth.iter_mut().find(|slot| **slot == auth) {
        *auth_slot = Pubkey::default();
    } else {
        return Err(error!(CloneError::AuthNotFound));
    }

    Ok(())
}
