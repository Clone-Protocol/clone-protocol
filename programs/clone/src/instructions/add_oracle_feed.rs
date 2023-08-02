use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(pyth_address: Pubkey)]
pub struct AddOracleFeed<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<AddOracleFeed>, pyth_address: Pubkey) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let info = OracleInfo {
        pyth_address,
        ..Default::default()
    };
    token_data.append_oracle_info(info);

    Ok(())
}
