use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawUnconcentratedLiquidity<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        has_one = incept,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        associated_token::mint = incept.usdi_mint,
        associated_token::authority = user
    )]
    pub user_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = token_data.load()?.pools[pool_index as usize].asset_info.iasset_mint,
        associated_token::authority = user
    )]
    pub user_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = user_liquidity_token_account.amount >= liquidity_token_amount @ InceptError::InvalidTokenAccountBalance,
        associated_token::mint = liquidity_token_mint,
        associated_token::authority = user
    )]
    pub user_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].usdi_token_account,
        constraint = amm_usdi_token_account.amount > 0 @ InceptError::InvalidTokenAccountBalance
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].iasset_token_account,
        constraint = amm_iasset_token_account.amount > 0 @ InceptError::InvalidTokenAccountBalance
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawUnconcentratedLiquidity>,
    pool_index: u8,
    liquidity_token_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let iasset_amm_value = Decimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    let usdi_amm_value = Decimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    let liquidity_token_supply = Decimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    // calculate the amount of iasset and usdi that the user can withdraw
    let (mut iasset_value, mut usdi_value) =
        calculate_liquidity_provider_values_from_liquidity_tokens(
            liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    iasset_value.rescale(DEVNET_TOKEN_SCALE);
    usdi_value.rescale(DEVNET_TOKEN_SCALE);

    // burn user liquidity tokens
    let cpi_accounts = Burn {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        from: ctx
            .accounts
            .user_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();

    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        liquidity_token_amount,
    )?;

    // transfer usdi to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let send_usdi_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_usdi_to_user_context,
        usdi_value.mantissa().try_into().unwrap(),
    )?;

    // transfer iasset to user from amm
    let cpi_accounts = Transfer {
        from: ctx
            .accounts
            .amm_iasset_token_account
            .to_account_info()
            .clone(),
        to: ctx
            .accounts
            .user_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
    };
    let send_iasset_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::transfer(
        send_iasset_to_user_context,
        iasset_value.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    Ok(())
}
