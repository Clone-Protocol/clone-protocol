use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(scale: u8, collateralization_ratio: u8, oracle_info_index: u8)]
pub struct AddCollateral<'info> {
    #[account(mut, address = clone.admin)]
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
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = collateral_mint,
        token::authority = clone,
        payer = admin
    )]
    pub vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<AddCollateral>,
    scale: u8,
    collateralization_ratio: u8,
    oracle_info_index: u8,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    // append collateral to list
    token_data.append_collateral(Collateral {
        oracle_info_index: oracle_info_index.into(),
        mint: *ctx.accounts.collateral_mint.to_account_info().key,
        vault: *ctx.accounts.vault.to_account_info().key,
        vault_borrow_supply: 0,
        vault_comet_supply: 0,
        collateralization_ratio: collateralization_ratio.into(),
        status: 0,
        scale: scale.into(),
    });

    Ok(())
}
