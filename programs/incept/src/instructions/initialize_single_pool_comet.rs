//use crate::instructions::InitializeSinglePoolComet;
use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
// use anchor_spl::token::*;
#[derive(Accounts)]
#[instruction(manager_nonce: u8, pool_index: u8, collateral_index: u8)]
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
        has_one = manager,
        constraint = (pool_index as u64) < token_data.load()?.num_pools,
        constraint = (collateral_index as u64) < token_data.load()?.num_collaterals,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = single_pool_comets.load()?.is_single_pool == 1,
        constraint = &single_pool_comets.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner
    )]
    pub single_pool_comets: AccountLoader<'info, Comet>,
}

pub fn execute(
    ctx: Context<InitializeSinglePoolComet>,
    _manager_nonce: u8,
    pool_index: u8,
    collateral_index: u8,
) -> ProgramResult {
    let single_pool_comets = &mut ctx.accounts.single_pool_comets.load_mut()?;

    single_pool_comets.add_collateral(CometCollateral {
        authority: *ctx.accounts.user.to_account_info().key,
        collateral_amount: RawDecimal::default(),
        collateral_index: collateral_index as u64,
    });
    single_pool_comets.add_position(CometPosition {
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
