use crate::states::*;
use crate::{CLONE_PROGRAM_SEED, TOKEN_DATA_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(collateralization_ratio: u8, oracle_info_index: u8)]
pub struct AddCollateral<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
        has_one = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        token::mint = collateral_mint,
        token::authority = clone,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<AddCollateral>,
    collateralization_ratio: u8,
    oracle_info_index: u8,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    // append collateral to list
    token_data.append_collateral(Collateral {
        oracle_info_index: oracle_info_index.into(),
        mint: *ctx.accounts.collateral_mint.to_account_info().key,
        vault: *ctx.accounts.vault.to_account_info().key,
        collateralization_ratio: collateralization_ratio.into(),
        status: 0,
        scale: ctx.accounts.collateral_mint.decimals.into(),
    });

    Ok(())
}
