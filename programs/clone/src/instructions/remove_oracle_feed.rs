use crate::{error::*, return_error_if_false, states::*};
use crate::{CLONE_PROGRAM_SEED, TOKEN_DATA_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct RemoveOracleFeed<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<RemoveOracleFeed>, index: u8) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    return_error_if_false!(
        (index as u64) < token_data.num_oracles,
        CloneError::InvalidOracleIndex
    );
    token_data.num_oracles -= 1;
    let last_entry_index = token_data.num_oracles as usize;
    let swap_info = token_data.oracles[last_entry_index];
    token_data.oracles[index as usize] = swap_info;
    token_data.oracles[last_entry_index] = OracleInfo::default();

    Ok(())
}
