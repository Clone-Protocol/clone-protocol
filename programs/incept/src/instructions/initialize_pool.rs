use crate::error::InceptError;
////use crate::instructions::InitializePool;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(stable_collateral_ratio: u16, crypto_collateral_ratio: u16, health_score_coefficient: u64)]
pub struct InitializePool<'info> {
    #[account(mut, address = manager.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager.bump,
        has_one = token_data,
        has_one = admin
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        address = manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = usdi_mint,
        token::authority = manager,
        payer = admin
    )]
    pub usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = manager,
        payer = admin
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = iasset_mint,
        token::authority = manager,
        payer = admin
    )]
    pub iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        token::mint = iasset_mint,
        token::authority = manager,
        payer = admin
    )]
    pub liquidation_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        mint::decimals = 8,
        mint::authority = manager,
        payer = admin
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = liquidity_token_mint,
        token::authority = manager,
        payer = admin
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: External pyth oracle, instruction can only be executed by admin
    pub pyth_oracle: AccountInfo<'info>,
    /// CHECK: External chainlink oracle, instruction can only be executed by admin
    pub chainlink_oracle: AccountInfo<'info>,
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
    health_score_coefficient: u64,
    liquidation_discount_rate: u64,
) -> Result<()> {
    // ensure valid health score coefficient
    require!(
        liquidation_discount_rate < 10000,
        InceptError::InvalidValueRange
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
        treasury_trading_fee: RawDecimal::from_percent(treasury_trading_fee),
        liquidity_trading_fee: RawDecimal::from_percent(liquidity_trading_fee),
        total_minted_amount: RawDecimal::default(),
        supplied_mint_collateral_amount: RawDecimal::default(),
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
    token_data.pools[index as usize]
        .asset_info
        .liquidation_discount_rate =
        RawDecimal::new(liquidation_discount_rate.try_into().unwrap(), 4);

    Ok(())
}
