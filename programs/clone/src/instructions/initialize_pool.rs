use crate::error::CloneError;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(
    stable_collateral_ratio: u16,
    crypto_collateral_ratio: u16,
    liquidity_trading_fee: u16,
    treasury_trading_fee: u16,
    il_health_score_coefficient: u64,
    position_health_score_coefficient: u64,
    liquidation_discount_rate: u64,
    max_ownership_pct: u64,
)]
pub struct InitializePool<'info> {
    #[account(mut, address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = onusd_mint,
        token::authority = clone,
        payer = admin
    )]
    pub onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = clone,
        payer = admin
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = onasset_mint,
        token::authority = clone,
        payer = admin
    )]
    pub onasset_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: External mint address, can only be selected by admin.
    pub underlying_asset_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = underlying_asset_mint,
        token::authority = clone,
        payer = admin
    )]
    pub underlying_asset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = clone,
        payer = admin
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = liquidity_token_mint,
        token::authority = clone,
        payer = admin
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: External pyth oracle, instruction can only be executed by admin
    pub pyth_oracle: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializePool>,
    stable_collateral_ratio: u16,
    crypto_collateral_ratio: u16,
    liquidity_trading_fee: u16,
    treasury_trading_fee: u16,
    il_health_score_coefficient: u64,
    position_health_score_coefficient: u64,
    liquidation_discount_rate: u64,
    max_ownership_pct: u64,
) -> Result<()> {
    // ensure valid health score coefficient
    return_error_if_false!(
        liquidation_discount_rate < 10000,
        CloneError::InvalidValueRange
    );
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    // append pool to list
    token_data.append_pool(Pool {
        onasset_token_account: *ctx.accounts.onasset_token_account.to_account_info().key,
        onusd_token_account: *ctx.accounts.onusd_token_account.to_account_info().key,
        liquidity_token_mint: *ctx.accounts.liquidity_token_mint.to_account_info().key,
        underlying_asset_token_account: *ctx
            .accounts
            .underlying_asset_token_account
            .to_account_info()
            .key,
        comet_liquidity_token_account: *ctx
            .accounts
            .comet_liquidity_token_account
            .to_account_info()
            .key,
        onasset_amount: RawDecimal::default(),
        onusd_amount: RawDecimal::default(),
        liquidity_token_supply: RawDecimal::default(),
        treasury_trading_fee: RawDecimal::from_bps(treasury_trading_fee.into()),
        liquidity_trading_fee: RawDecimal::from_bps(liquidity_trading_fee.into()),
        total_minted_amount: RawDecimal::default(),
        supplied_mint_collateral_amount: RawDecimal::default(),
        asset_info: AssetInfo {
            ..Default::default()
        },
        deprecated: 0,
    });
    let index = token_data.num_pools - 1;
    token_data.pools[index as usize].asset_info.onasset_mint =
        *ctx.accounts.onasset_mint.to_account_info().key;
    token_data.pools[index as usize].asset_info.pyth_address =
        ctx.accounts.pyth_oracle.to_account_info().key();
    token_data.pools[index as usize]
        .asset_info
        .stable_collateral_ratio = RawDecimal::from_percent(stable_collateral_ratio);
    token_data.pools[index as usize]
        .asset_info
        .crypto_collateral_ratio = RawDecimal::from_percent(crypto_collateral_ratio);
    token_data.pools[index as usize]
        .asset_info
        .il_health_score_coefficient = RawDecimal::new(
        il_health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[index as usize]
        .asset_info
        .position_health_score_coefficient = RawDecimal::new(
        position_health_score_coefficient.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[index as usize]
        .asset_info
        .liquidation_discount_rate =
        RawDecimal::new(liquidation_discount_rate.try_into().unwrap(), 4);
    token_data.pools[index as usize]
        .asset_info
        .max_ownership_pct = RawDecimal::from_percent(max_ownership_pct.try_into().unwrap());

    Ok(())
}