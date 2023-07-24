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
#[instruction(
    pool_index: u8,
    quantity: u64,
    quantity_is_input: bool,
    quantity_is_onusd: bool,
    result_threshold: u64
)]
pub struct Swap<'info> {
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
        constraint = token_data.load()?.pools[pool_index as usize].status == Status::Active as u64 @ CloneError::StatusPreventsAction,
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
    #[account(
        mut,
        associated_token::mint = onusd_mint,
        associated_token::authority = clone.treasury_address
    )]
    pub treasury_onusd_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<Swap>,
    pool_index: u8,
    quantity: u64,
    quantity_is_input: bool,
    quantity_is_onusd: bool,
    result_threshold: u64,
) -> Result<()> {
    let seeds = &[&[b"clone", bytemuck::bytes_of(&ctx.accounts.clone.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];

    return_error_if_false!(
        check_feed_update(oracle, Clock::get()?.slot).is_ok(),
        CloneError::OutdatedOracle
    );

    return_error_if_false!(
        pool.committed_onusd_liquidity.to_decimal() > Decimal::ZERO,
        CloneError::PoolEmpty
    );

    let user_specified_quantity = Decimal::new(quantity.try_into().unwrap(), CLONE_TOKEN_SCALE);
    let oracle_price = oracle.price.to_decimal();
    let swap_summary = pool.calculate_swap(
        oracle_price,
        user_specified_quantity,
        quantity_is_input,
        quantity_is_onusd,
    );

    return_error_if_false!(
        user_specified_quantity > Decimal::ZERO
            && swap_summary.result > Decimal::ZERO
            && swap_summary.liquidity_fees_paid > Decimal::ZERO
            && swap_summary.treasury_fees_paid > Decimal::ZERO,
        CloneError::InvalidTokenAmount
    );

    let threshold = Decimal::new(result_threshold.try_into().unwrap(), CLONE_TOKEN_SCALE);

    let (
        input_is_onusd,
        user_input_account,
        input_mint,
        burn_amount,
        user_output_account,
        output_mint,
        output_amount,
        treasury_output_account,
        onasset_ild_delta,
        onusd_ild_delta,
    ) = if quantity_is_input {
        return_error_if_false!(
            swap_summary.result >= threshold,
            CloneError::SlippageToleranceExceeded
        );
        let ild_delta_input = -user_specified_quantity;
        let ild_delta_output = rescale_toward_zero(
            swap_summary.result + swap_summary.treasury_fees_paid,
            CLONE_TOKEN_SCALE,
        );
        if quantity_is_onusd {
            // User specifies input, input (onusd), output (onasset)
            (
                true,
                ctx.accounts
                    .user_onusd_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onusd_mint.to_account_info().clone(),
                user_specified_quantity,
                ctx.accounts
                    .user_onasset_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onasset_mint.to_account_info().clone(),
                swap_summary.result,
                ctx.accounts
                    .treasury_onasset_token_account
                    .to_account_info()
                    .clone(),
                ild_delta_output,
                ild_delta_input,
            )
        } else {
            // User specifies input, input (onasset), output (onusd)
            (
                false,
                ctx.accounts
                    .user_onasset_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onasset_mint.to_account_info().clone(),
                user_specified_quantity,
                ctx.accounts
                    .user_onusd_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onusd_mint.to_account_info().clone(),
                swap_summary.result,
                ctx.accounts
                    .treasury_onusd_token_account
                    .to_account_info()
                    .clone(),
                ild_delta_input,
                ild_delta_output,
            )
        }
    } else {
        return_error_if_false!(
            swap_summary.result <= threshold,
            CloneError::SlippageToleranceExceeded
        );
        let ild_delta_input = -swap_summary.result;
        let ild_delta_output = rescale_toward_zero(
            user_specified_quantity + swap_summary.treasury_fees_paid,
            CLONE_TOKEN_SCALE,
        );
        if quantity_is_onusd {
            // User specifies output, input (onasset), output (onusd)
            (
                false,
                ctx.accounts
                    .user_onasset_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onasset_mint.to_account_info().clone(),
                swap_summary.result,
                ctx.accounts
                    .user_onusd_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onusd_mint.to_account_info().clone(),
                user_specified_quantity,
                ctx.accounts
                    .treasury_onusd_token_account
                    .to_account_info()
                    .clone(),
                ild_delta_input,
                ild_delta_output,
            )
        } else {
            // User specifies output, input (onusd), output (onasset)
            (
                true,
                ctx.accounts
                    .user_onusd_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onusd_mint.to_account_info().clone(),
                swap_summary.result,
                ctx.accounts
                    .user_onasset_token_account
                    .to_account_info()
                    .clone(),
                ctx.accounts.onasset_mint.to_account_info().clone(),
                user_specified_quantity,
                ctx.accounts
                    .treasury_onasset_token_account
                    .to_account_info()
                    .clone(),
                ild_delta_output,
                ild_delta_input,
            )
        }
    };

    // burn from user
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: input_mint,
                from: user_input_account,
                authority: ctx.accounts.user.to_account_info().clone(),
            },
        ),
        burn_amount.mantissa().try_into().unwrap(),
    )?;

    // mint to user
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            MintTo {
                to: user_output_account,
                mint: output_mint.clone(),
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            seeds,
        ),
        output_amount.mantissa().try_into().unwrap(),
    )?;

    // Mint treasury fee to treasury token account
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            MintTo {
                mint: output_mint,
                to: treasury_output_account,
                authority: ctx.accounts.clone.to_account_info().clone(),
            },
            seeds,
        ),
        swap_summary
            .treasury_fees_paid
            .mantissa()
            .try_into()
            .unwrap(),
    )?;

    let onasset_ild = rescale_toward_zero(
        token_data.pools[pool_index as usize]
            .onasset_ild
            .to_decimal()
            + onasset_ild_delta,
        CLONE_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].onasset_ild = RawDecimal::from(onasset_ild);
    let onusd_ild = rescale_toward_zero(
        token_data.pools[pool_index as usize].onusd_ild.to_decimal() + onusd_ild_delta,
        CLONE_TOKEN_SCALE,
    );
    token_data.pools[pool_index as usize].onusd_ild = RawDecimal::from(onusd_ild);

    emit!(SwapEvent {
        event_id: ctx.accounts.clone.event_counter,
        user_address: ctx.accounts.user.key(),
        pool_index,
        input_is_onusd,
        input: burn_amount.mantissa().try_into().unwrap(),
        output: output_amount.mantissa().try_into().unwrap(),
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
    let oracle_price = rescale_toward_zero(oracle_price, CLONE_TOKEN_SCALE);

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
