use crate::{error::CloneError, states::*};
use crate::{return_error_if_false, CLONE_PROGRAM_SEED, POOLS_SEED};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Copy, Eq, Debug)]
pub enum PoolParameters {
    Status { value: Status },
    TreasuryTradingFee { value: u16 },
    LiquidityTradingFee { value: u16 },
    OracleInfoIndex { value: u8 },
    MinOvercollateralRatio { value: u16 },
    MaxLiquidationOvercollateralRatio { value: u16 },
    IlHealthScoreCoefficient { value: u16 },
    PositionHealthScoreCoefficient { value: u16 },
}

#[derive(Accounts)]
#[instruction(
    index: u8,
    params: PoolParameters
)]
pub struct UpdatePoolParameters<'info> {
    pub auth: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = (index as usize) < pools.pools.len() @ CloneError::PoolNotFound,
    )]
    pub pools: Box<Account<'info, Pools>>,
}

pub fn execute(
    ctx: Context<UpdatePoolParameters>,
    index: u8,
    params: PoolParameters,
) -> Result<()> {
    let auth_key = *ctx.accounts.auth.key;
    let clone_admin = ctx.accounts.clone.admin;
    let clone_auth = ctx.accounts.clone.auth.clone();

    let pools = &mut ctx.accounts.pools;
    let pool = &mut pools.pools[index as usize];

    let is_admin = auth_key == clone_admin;
    let is_auth = clone_auth.iter().any(|auth| *auth == auth_key);

    // Always allow admin, auth only if Status is updated to Frozen
    return_error_if_false!(
        if is_admin {
            true
        } else if is_auth {
            if let PoolParameters::Status { value } = params {
                value == Status::Frozen
            } else {
                false
            }
        } else {
            false
        },
        CloneError::Unauthorized
    );

    match params {
        PoolParameters::Status { value } => {
            pool.status = value;
        }
        PoolParameters::TreasuryTradingFee { value } => {
            pool.treasury_trading_fee_bps = value;
        }
        PoolParameters::LiquidityTradingFee { value } => {
            pool.liquidity_trading_fee_bps = value;
        }
        PoolParameters::OracleInfoIndex { value } => {
            pool.asset_info.oracle_info_index = value;
        }
        PoolParameters::MinOvercollateralRatio { value } => {
            pool.asset_info.min_overcollateral_ratio = value;
        }
        PoolParameters::MaxLiquidationOvercollateralRatio { value } => {
            pool.asset_info.max_liquidation_overcollateral_ratio = value;
        }
        PoolParameters::IlHealthScoreCoefficient { value } => {
            pool.asset_info.il_health_score_coefficient = value;
        }
        PoolParameters::PositionHealthScoreCoefficient { value } => {
            pool.asset_info.position_health_score_coefficient = value;
        }
    }
    Ok(())
}
