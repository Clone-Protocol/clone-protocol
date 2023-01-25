use crate::error::InceptError;
use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, pool_index: u8, force_removal: bool)]
pub struct RemovePool<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
        has_one = admin
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager,
        constraint = token_data.load()?.num_pools > (pool_index as u64) @ InceptError::InvalidInputPositionIndex
    )]
    pub token_data: AccountLoader<'info, TokenData>
}

pub fn execute(
    ctx: Context<RemovePool>,
    _manager_nonce: u8,
    pool_index: u8,
    force_removal: bool,
) -> ProgramResult {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let num_pools = token_data.num_pools as usize;
    let num_collaterals = token_data.num_collaterals as usize;
    let pool_index = pool_index as usize;
    let pool = token_data.pools[pool_index as usize];

    if !force_removal {
        assert!(
            pool.usdi_amount.to_decimal().is_zero()
                && pool.iasset_amount.to_decimal().is_zero()
                && pool.liquidity_token_supply.to_decimal().is_zero(),
            "Can't remove pool with liquidity still present!"
        );
    }

    // Update pool data
    token_data.pools[pool_index as usize] = token_data.pools[num_pools - 1];
    token_data.pools[num_pools - 1] = Pool::default();
    token_data.num_pools = (num_pools - 1) as u64;

    // Need to search through collaterals to see if pool is matching
    for index in 0..num_collaterals {
        let collateral = token_data.collaterals[index];
        if collateral.pool_index as usize == num_pools - 1 {
            token_data.collaterals[index].pool_index = pool_index as u64;
            break;
        }
    }

    Ok(())
}
