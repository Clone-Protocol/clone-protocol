use crate::{error::CloneError, states::*};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum PoolParameters {
    Status { value: u8 },
    TreasuryTradingFee { value: RawDecimal },
    LiquidityTradingFee { value: RawDecimal },
    PythAddress { address: Pubkey },
    StableCollateralRatio { value: RawDecimal },
    CryptoCollateralRatio { value: RawDecimal },
    IlHealthScoreCoefficient { value: RawDecimal },
    PositionHealthScoreCoefficient { value: RawDecimal },
    LiquidationDiscountRate { value: RawDecimal },
    MaxOwnershipPct { value: RawDecimal },
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
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Account<'info, Clone>,
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

    if !is_admin && !is_auth {
        return Err(error!(CloneError::Unauthorized));
    }

    match params {
        PoolParameters::Status { value } => {
            // Only allow auth users to change the status to 'Frozen'
            if !is_admin && value != Status::Frozen as u8 {
                return Err(error!(CloneError::Unauthorized));
            }
            if value > Status::Deprecation as u8 {
                return Err(error!(CloneError::InvalidStatus));
            }
            pool.status = value;
            if !is_admin {
                return Ok(());
            }
        }
        PoolParameters::TreasuryTradingFee { value } => {
            pool.treasury_trading_fee = value;
        }
        PoolParameters::LiquidityTradingFee { value } => {
            pool.liquidity_trading_fee = value;
        }
        PoolParameters::PythAddress { address } => {
            pool.asset_info.pyth_address = address;
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
        PoolParameters::LiquidationDiscountRate { value } => {
            pool.asset_info.liquidation_discount_rate = value;
        }
        PoolParameters::MaxOwnershipPct { value } => {
            pool.asset_info.max_ownership_pct = value;
        }
    }
    Ok(())
}
