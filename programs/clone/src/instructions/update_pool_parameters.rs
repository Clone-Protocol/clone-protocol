use crate::{error::CloneError, states::*};
use crate::{return_error_if_false, CLONE_PROGRAM_SEED};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum PoolParameters {
    Status { value: u64 },
    TreasuryTradingFee { value: u64 },
    LiquidityTradingFee { value: u64 },
    OracleInfoIndex { value: u64 },
    StableCollateralRatio { value: u64 },
    CryptoCollateralRatio { value: u64 },
    IlHealthScoreCoefficient { value: u64 },
    PositionHealthScoreCoefficient { value: u64 },
}

#[derive(Accounts)]
#[instruction(
    index: u8,
    params: PoolParameters
)]
pub struct UpdatePoolParameters<'info> {
    pub auth: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = (index as u64) < token_data.load()?.num_pools @ CloneError::PoolNotFound,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(
    ctx: Context<UpdatePoolParameters>,
    index: u8,
    params: PoolParameters,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let pool = &mut token_data.pools[index as usize];

    let is_admin = *ctx.accounts.auth.key == ctx.accounts.clone.admin;
    let is_auth = ctx
        .accounts
        .clone
        .auth
        .iter()
        .any(|auth| *auth == *ctx.accounts.auth.key);

    // Always allow admin, auth only if Status is updated to Frozen
    return_error_if_false!(
        if is_admin {
            true
        } else if is_auth {
            if let PoolParameters::Status { value } = params {
                value == (Status::Frozen as u64)
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
            pool.treasury_trading_fee = value;
        }
        PoolParameters::LiquidityTradingFee { value } => {
            pool.liquidity_trading_fee = value;
        }
        PoolParameters::OracleInfoIndex { value } => {
            pool.asset_info.oracle_info_index = value;
        }
        PoolParameters::StableCollateralRatio { value } => {
            pool.asset_info.stable_collateral_ratio = value;
        }
        PoolParameters::CryptoCollateralRatio { value } => {
            pool.asset_info.crypto_collateral_ratio = value;
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
