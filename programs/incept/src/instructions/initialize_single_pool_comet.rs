use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction( pool_index: u8, collateral_index: u8)]
pub struct InitializeSinglePoolComet<'info> {
    #[account(address = single_pool_comets.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        has_one = incept,
        constraint = (pool_index as u64) < token_data.load()?.num_pools,
        constraint = (collateral_index as u64) < token_data.load()?.num_collaterals,
        constraint = token_data.load()?.pools[pool_index as usize].deprecated == false //@ InceptError::PoolDeprecated
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.single_pool_comets,
        constraint = single_pool_comets.load()?.is_single_pool == 1,
    )]
    pub single_pool_comets: AccountLoader<'info, Comet>,
}

pub fn execute(
    ctx: Context<InitializeSinglePoolComet>,

    pool_index: u8,
    collateral_index: u8,
) -> Result<()> {
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
