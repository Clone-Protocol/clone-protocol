use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(pool_index: u8, onasset_amount: u64, onusd_amount_threshold: u64)]
pub struct BuyOnAsset<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
        constraint = (pool_index as u64) < token_data.load()?.num_pools @ CloneError::InvalidInputPositionIndex,
        constraint = token_data.load()?.pools[pool_index as usize].deprecated == 0 @ CloneError::PoolDeprecated
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = user
    )]
    pub user_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = user
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = onasset_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<BuyOnAsset>,
    pool_index: u8,
    amount: u64,
    onusd_spend_threshold: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];

    return_error_if_false!(
        check_feed_update(pool.asset_info, Clock::get()?.slot).is_ok(),
        CloneError::OutdatedOracle
    );

    return_error_if_false!(
        pool.committed_onusd_liquidity.to_decimal() > Decimal::ZERO,
        CloneError::PoolEmpty
    );

    let onasset_amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    // calculate how much onusd must be spent
    let swap_summary = pool.calculate_usd_to_buy(onasset_amount_value);
    let onusd_amount_value = swap_summary.result;
    // ensure that the user has sufficient onusd
    return_error_if_false!(
        ctx.accounts.user_onusd_token_account.amount
            >= onusd_amount_value.mantissa().try_into().unwrap(),
        CloneError::InvalidTokenAmount
    );
    // ensure it's within slippage tolerance
    let max_onusd_to_spend = Decimal::new(
        onusd_spend_threshold.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    return_error_if_false!(
        max_onusd_to_spend >= onusd_amount_value,
        CloneError::SlippageToleranceExceeded
    );

    // burn onusd from user
    let cpi_accounts = Burn {
        from: ctx
            .accounts
            .user_onusd_token_account
            .to_account_info()
            .clone(),
        mint: ctx.accounts.onusd_mint.to_account_info().clone(),
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let burn_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
    );

    token::burn(
        burn_context,
        onusd_amount_value.mantissa().try_into().unwrap(),
    )?;

    // mint onasset to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .user_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let mint_onasset_to_user_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::mint_to(
        mint_onasset_to_user_context,
        onasset_amount_value.mantissa().try_into().unwrap(),
    )?;

    // Mint treasury fee to treasury token account
    let treasury_fee_to_pay =
        rescale_toward_zero(swap_summary.treasury_fees_paid, DEVNET_TOKEN_SCALE);
    let cpi_accounts = MintTo {
        mint: ctx.accounts.onasset_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .treasury_onasset_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.clone.to_account_info().clone(),
    };
    let mint_onasset_to_treasury_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_accounts,
        seeds,
    );

    token::mint_to(
        mint_onasset_to_treasury_context,
        treasury_fee_to_pay.mantissa().try_into().unwrap(),
    )?;

    // update pool data
    let onasset_ild = rescale_toward_zero(
        token_data.pools[pool_index as usize]
            .onasset_ild
            .to_decimal()
            + onasset_amount_value
            + treasury_fee_to_pay,
        DEVNET_TOKEN_SCALE,
    );
    let onusd_ild = rescale_toward_zero(
        token_data.pools[pool_index as usize].onusd_ild.to_decimal() - onusd_amount_value,
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].onasset_ild = RawDecimal::from(onasset_ild);
    token_data.pools[pool_index as usize].onusd_ild = RawDecimal::from(onusd_ild);

    emit!(SwapEvent {
        event_id: ctx.accounts.clone.event_counter,
        user: ctx.accounts.user.key(),
        pool_index,
        is_buy: true,
        onasset: onasset_amount_value.mantissa().try_into().unwrap(),
        onusd: onusd_amount_value.mantissa().try_into().unwrap(),
        trading_fee: swap_summary
            .liquidity_fees_paid
            .mantissa()
            .try_into()
            .unwrap(),
        treasury_fee: swap_summary
            .treasury_fees_paid
            .mantissa()
            .try_into()
            .unwrap()
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.clone.event_counter,
        pool_index,
        onasset_ild: onasset_ild.mantissa().try_into().unwrap(),
        onusd_ild: onusd_ild.mantissa().try_into().unwrap(),
        committed_onusd_liquidity: pool
            .committed_onusd_liquidity
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
