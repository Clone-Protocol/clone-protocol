use crate::error::InceptError;
use crate::instructions::InitializePool;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

pub fn execute(
    ctx: Context<InitializePool>,
    _manager_nonce: u8,
    stable_collateral_ratio: u16,
    crypto_collateral_ratio: u16,
    liquidity_trading_fee: u16,
    health_score_coefficient: u64,
) -> ProgramResult {
    // ensure valid health score coefficient
    require!(
        health_score_coefficient > 0,
        InceptError::InvalidHealthScoreCoefficient
    );
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    // append pool to list
    token_data.append_pool(Pool {
        iasset_token_account: *ctx.accounts.iasset_token_account.to_account_info().key,
        usdi_token_account: *ctx.accounts.usdi_token_account.to_account_info().key,
        liquidity_token_mint: *ctx.accounts.liquidity_token_mint.to_account_info().key,
        liquidation_iasset_token_account: *ctx
            .accounts
            .liquidation_iasset_token_account
            .to_account_info()
            .key,
        comet_liquidity_token_account: *ctx
            .accounts
            .comet_liquidity_token_account
            .to_account_info()
            .key,
        iasset_amount: RawDecimal::default(),
        usdi_amount: RawDecimal::default(),
        liquidity_token_supply: RawDecimal::default(),
        treasury_trading_fee: RawDecimal::from_percent(0),
        liquidity_trading_fee: RawDecimal::from_percent(liquidity_trading_fee),
        asset_info: AssetInfo {
            ..Default::default()
        },
    });
    let index = token_data.num_pools - 1;
    token_data.pools[index as usize].asset_info.iasset_mint =
        *ctx.accounts.iasset_mint.to_account_info().key;
    token_data.pools[index as usize]
        .asset_info
        .price_feed_addresses = [
        *ctx.accounts.pyth_oracle.to_account_info().key,
        *ctx.accounts.chainlink_oracle.to_account_info().key,
    ];
    token_data.pools[index as usize]
        .asset_info
        .stable_collateral_ratio = RawDecimal::from_percent(stable_collateral_ratio);
    token_data.pools[index as usize]
        .asset_info
        .crypto_collateral_ratio = RawDecimal::from_percent(crypto_collateral_ratio);
    token_data.pools[index as usize]
        .asset_info
        .health_score_coefficient = RawDecimal::new(
        health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
