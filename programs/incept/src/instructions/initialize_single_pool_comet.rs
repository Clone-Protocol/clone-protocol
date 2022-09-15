//use crate::instructions::InitializeSinglePoolComet;
use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
#[derive(Accounts)]
#[instruction(manager_nonce: u8, pool_index: u8)]
pub struct InitializeSinglePoolComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &single_pool_comets.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner
    )]
    pub single_pool_comets: AccountLoader<'info, SinglePoolComets>,
    #[account(zero)]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializeSinglePoolComet>,
    _manager_nonce: u8,
    pool_index: u8,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let (_, collateral_index) = token_data
        .get_collateral_tuple(*ctx.accounts.vault.to_account_info().key)
        .unwrap();

    // set comet data
    let mut single_pool_comets = ctx.accounts.single_pool_comets.load_mut()?;
    let num_comets = single_pool_comets.num_comets;

    // add comet key to user's single pool comets
    single_pool_comets.comets[num_comets as usize] =
        *ctx.accounts.single_pool_comet.to_account_info().key;
    single_pool_comets.num_comets += 1;

    // set single pool comet data
    let mut single_pool_comet = ctx.accounts.single_pool_comet.load_init()?;
    single_pool_comet.is_single_pool = 1;
    single_pool_comet.owner = *ctx.accounts.user.to_account_info().key;
    single_pool_comet.add_collateral(CometCollateral {
        authority: *ctx.accounts.user.to_account_info().key,
        collateral_amount: RawDecimal::default(),
        collateral_index: collateral_index as u64,
    });
    single_pool_comet.add_position(CometPosition {
        authority: *ctx.accounts.user.to_account_info().key,
        pool_index: pool_index as u64,
        borrowed_usdi: RawDecimal::default(),
        borrowed_iasset: RawDecimal::default(),
        liquidity_token_value: RawDecimal::default(),
        comet_liquidation: CometLiquidation {
            ..Default::default()
        },
    });

    Ok(())
}
