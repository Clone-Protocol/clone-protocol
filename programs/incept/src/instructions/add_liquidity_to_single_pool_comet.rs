use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

//use crate::instructions::AddLiquidityToComet;

#[derive(Accounts)]
#[instruction(user_nonce: u8, manager_nonce: u8, position_index: u8, usdi_amount: u64)]
pub struct AddLiquidityToSinglePoolComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.single_pool_comets,
        constraint = single_pool_comet.load()?.is_single_pool == 1,
        constraint = &single_pool_comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (position_index as u64) < single_pool_comet.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].liquidity_token_mint,
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[single_pool_comet.load()?.positions[position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<AddLiquidityToSinglePoolComet>,
    user_nonce: u8,
    manager_nonce: u8,
    position_index: u8,
    usdi_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.single_pool_comet.load_mut()?;

    let pool_index = comet.positions[position_index as usize].pool_index as usize;

    let usdi_liquidity_value = Decimal::new(usdi_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

    // calculate iasset liquidity value as well as liquidity token value for comet
    let (mut iasset_liquidity_value, mut liquidity_token_value) =
        calculate_liquidity_provider_values_from_usdi(
            usdi_liquidity_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    let position = comet.positions[position_index as usize];
    // update comet position data
    let mut borrowed_usdi = position.borrowed_usdi.to_decimal() + usdi_liquidity_value;
    borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

    let mut borrowed_iasset = position.borrowed_iasset.to_decimal() + iasset_liquidity_value;
    borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

    liquidity_token_value += position.liquidity_token_value.to_decimal();
    liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

    let mut lp_tokens_to_mint = liquidity_token_value
        - comet.positions[position_index as usize]
            .liquidity_token_value
            .to_decimal();

    comet.positions[position_index as usize].borrowed_usdi = RawDecimal::from(borrowed_usdi);
    comet.positions[position_index as usize].borrowed_iasset = RawDecimal::from(borrowed_iasset);
    comet.positions[position_index as usize].liquidity_token_value =
        RawDecimal::from(liquidity_token_value);

    iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
    liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
    lp_tokens_to_mint.rescale(DEVNET_TOKEN_SCALE);

    // mint liquidity into amm
    let cpi_accounts = MintTo {
        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let mint_usdi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    token::mint_to(mint_usdi_context, usdi_amount)?;
    let cpi_accounts = MintTo {
        mint: ctx.accounts.iasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .amm_iasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let mint_iasset_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );
    token::mint_to(
        mint_iasset_context,
        iasset_liquidity_value.mantissa().try_into().unwrap(),
    )?;

    // mint liquidity tokens to comet
    let cpi_accounts = MintTo {
        mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .comet_liquidity_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.manager.to_account_info().clone(),
    };
    let mint_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::mint_to(
        mint_liquidity_tokens_to_comet_context,
        lp_tokens_to_mint.mantissa().try_into().unwrap(),
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

    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, token_data, Some(position_index as usize))?;

    require!(
        matches!(health_score, HealthScore::Healthy { .. }),
        InceptError::HealthScoreTooLow
    );

    Ok(())
}
