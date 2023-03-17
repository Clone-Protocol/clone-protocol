use crate::{error::InceptError, states::*};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum PoolParameters {
    TreasuryTradingFee { value: RawDecimal },
    LiquidityTradingFee { value: RawDecimal },
    PriceFeedAddresses { addresses: [Pubkey; 2] },
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
    #[account(address = incept.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept,
        constraint = (index as u64) < token_data.load()?.num_pools @ InceptError::PoolNotFound,
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

    match params {
        PoolParameters::TreasuryTradingFee { value } => {
            pool.treasury_trading_fee = value;
        }
        PoolParameters::LiquidityTradingFee { value } => {
            pool.liquidity_trading_fee = value;
        }
        PoolParameters::PriceFeedAddresses { addresses } => {
            pool.asset_info.price_feed_addresses = addresses;
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
