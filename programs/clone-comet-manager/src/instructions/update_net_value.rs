use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use clone::states::{Comet, Clone, TokenData, User, DEVNET_TOKEN_SCALE, USDC_COLLATERAL_INDEX};
use rust_decimal::prelude::*;

#[derive(Accounts)]
pub struct UpdateNetValue<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"manager-info", manager_info.owner.key().as_ref()],
        bump,
    )]
    pub manager_info: Box<Account<'info, ManagerInfo>>,
    #[account(
        mut,
        address = manager_info.user_account
    )]
    pub manager_clone_user: Box<Account<'info, User>>,
    #[account(
        address = manager_info.clone
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        associated_token::mint = onusd_mint,
        associated_token::authority = manager_info
    )]
    pub manager_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].mint,
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(
        associated_token::mint = usdc_mint,
        associated_token::authority = manager_info
    )]
    pub manager_usdc_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        address = manager_clone_user.comet
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        address = clone.token_data
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<UpdateNetValue>) -> Result<()> {
    // Calculate onusd value to withdraw according to tokens redeemed.
    let token_data = ctx.accounts.token_data.load()?;
    let comet = ctx.accounts.comet.load()?;

    let mut comet_onusd_value = comet.estimate_onusd_value(&token_data)
        + Decimal::new(
            ctx.accounts
                .manager_onusd_token_account
                .amount
                .try_into()
                .unwrap(),
            DEVNET_TOKEN_SCALE,
        )
        + Decimal::new(
            ctx.accounts
                .manager_usdc_token_account
                .amount
                .try_into()
                .unwrap(),
            DEVNET_TOKEN_SCALE,
        );

    // First check all onasset balances:
    for index in 0..token_data.num_pools as usize {
        let account_info = &ctx.remaining_accounts[index];
        let token_account: Account<TokenAccount> = Account::try_from(account_info)?;
        let asset_info = token_data.pools[index].asset_info;
        require_keys_eq!(token_account.owner, ctx.accounts.manager_info.key());
        require_keys_eq!(token_account.mint, asset_info.onasset_mint);
        let token_balance =
            Decimal::new(token_account.amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
        comet_onusd_value += asset_info.price.to_decimal() * token_balance;
    }

    // Check underlying token accounts
    for index in 0..token_data.num_pools as usize {
        let account_info_manager_token_account =
            &ctx.remaining_accounts[index + token_data.num_pools as usize];
        let account_info_pool_token_account =
            &ctx.remaining_accounts[index + 2 * token_data.num_pools as usize];
        let mint_account_info = &ctx.remaining_accounts[index + 3 * token_data.num_pools as usize];

        let pool = token_data.pools[index];
        require_keys_eq!(
            pool.underlying_asset_token_account.key(),
            account_info_pool_token_account.key()
        );

        let manager_token_account: Account<TokenAccount> =
            Account::try_from(account_info_manager_token_account)?;
        let pool_token_account: Account<TokenAccount> =
            Account::try_from(account_info_pool_token_account)?;
        let underlying_mint: Account<Mint> = Account::try_from(mint_account_info)?;

        require_keys_eq!(manager_token_account.owner, ctx.accounts.manager_info.key());
        require_keys_eq!(manager_token_account.mint, pool_token_account.mint);
        require_keys_eq!(manager_token_account.mint, underlying_mint.key());

        let mint_decimals = underlying_mint.decimals;
        let token_balance = Decimal::new(
            manager_token_account.amount.try_into().unwrap(),
            mint_decimals.into(),
        );
        comet_onusd_value += pool.asset_info.price.to_decimal() * token_balance;
    }

    ctx.accounts
        .manager_info
        .update_current_onusd_value(comet_onusd_value)?;

    Ok(())
}