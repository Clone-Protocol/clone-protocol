// use crate::{error::*, states::*};
// use crate::{CLONE_PROGRAM_SEED, POOLS_SEED};
// use anchor_lang::prelude::*;

// #[derive(Accounts)]
// #[instruction(
//     pool_index: u8, committed_collateral_liquidity: u64, collateral_ild: i64, onasset_ild: i64
// )]
// pub struct UpdatePoolData<'info> {
//     #[account(mut, address = clone.admin)]
//     pub admin: Signer<'info>,
//     #[account(
//         seeds = [CLONE_PROGRAM_SEED.as_ref()],
//         bump = clone.bump,
//         has_one = admin
//     )]
//     pub clone: Box<Account<'info, Clone>>,
//     #[account(
//         mut,
//         seeds = [POOLS_SEED.as_ref()],
//         bump,
//         constraint = (pool_index as usize) < pools.pools.len() @ CloneError::PoolNotFound,
//     )]
//     pub pools: Box<Account<'info, Pools>>,
// }

// pub fn execute(ctx: Context<UpdatePoolData>, pool_index: u8, committed_collateral_liquidity: u64, collateral_ild: i64, onasset_ild: i64) -> Result<()> {
//     let pools = &mut ctx.accounts.pools;
//     pools.pools[pool_index as usize].committed_collateral_liquidity = committed_collateral_liquidity;
//     pools.pools[pool_index as usize].collateral_ild = collateral_ild;
//     pools.pools[pool_index as usize].onasset_ild = onasset_ild;
//     Ok(())
// }
