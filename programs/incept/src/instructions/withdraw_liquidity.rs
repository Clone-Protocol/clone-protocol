use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

//use crate::instructions::WithdrawLiquidity;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, liquidity_position_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawLiquidity<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = &liquidity_positions.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner
    )]
    pub liquidity_positions: AccountLoader<'info, LiquidityPositions>,
    #[account(
        mut,
        associated_token::mint = manager.usdi_mint,
        associated_token::authority = user
    )]
    pub user_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = token_data.load()?.pools[liquidity_positions.load()?.liquidity_positions[liquidity_position_index as usize].pool_index as usize].asset_info.iasset_mint,
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
        address = token_data.load()?.pools[liquidity_positions.load()?.liquidity_positions[liquidity_position_index as usize].pool_index as usize].usdi_token_account,
        constraint = amm_usdi_token_account.amount > 0 @ InceptError::InvalidTokenAccountBalance
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[liquidity_positions.load()?.liquidity_positions[liquidity_position_index as usize].pool_index as usize].iasset_token_account,
        constraint = amm_iasset_token_account.amount > 0 @ InceptError::InvalidTokenAccountBalance
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[liquidity_positions.load()?.liquidity_positions[liquidity_position_index as usize].pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}
impl<'a, 'b, 'c, 'info> From<&WithdrawLiquidity<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Burn<'info>>
{
    fn from(accounts: &WithdrawLiquidity<'info>) -> CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: accounts.liquidity_token_mint.to_account_info().clone(),
            to: accounts
                .user_liquidity_token_account
                .to_account_info()
                .clone(),
            authority: accounts.user.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn execute(
    ctx: Context<WithdrawLiquidity>,
    manager_nonce: u8,
    liquidity_position_index: u8,
    liquidity_token_amount: u64,
) -> ProgramResult {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
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
    let cpi_ctx = CpiContext::from(&*ctx.accounts);
    token::burn(cpi_ctx, liquidity_token_amount)?;

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
        authority: ctx.accounts.manager.to_account_info().clone(),
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
        authority: ctx.accounts.manager.to_account_info().clone(),
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

    // update liquidity position data
    let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
    let liquidity_position =
        liquidity_positions.liquidity_positions[liquidity_position_index as usize];
    liquidity_positions.liquidity_positions[liquidity_position_index as usize]
        .liquidity_token_value = RawDecimal::from(
        liquidity_position.liquidity_token_value.to_decimal() - liquidity_token_value,
    );

    if liquidity_positions.liquidity_positions[liquidity_position_index as usize]
        .liquidity_token_value
        .to_decimal()
        .mantissa()
        == 0
    {
        // remove liquidity position from user list
        liquidity_positions.remove(liquidity_position_index as usize);
    }

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[liquidity_position.pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[liquidity_position.pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[liquidity_position.pool_index as usize].liquidity_token_supply =
        RawDecimal::new(
            ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

    Ok(())
}
