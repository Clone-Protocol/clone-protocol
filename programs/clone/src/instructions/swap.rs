use crate::decimal::{rescale_toward_zero, CLONE_TOKEN_SCALE};
use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use crate::to_bps_decimal;
use crate::{return_error_if_false, to_clone_decimal, CLONE_PROGRAM_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use clone_staking::{
    program::CloneStaking as CloneStakingProgram,
    states::{CloneStaking, User as UserStaking},
    CLONE_STAKING_SEED, USER_SEED as USER_STAKING_SEED,
};
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
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
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
    #[account(
        seeds = [CLONE_STAKING_SEED.as_ref()],
        bump,
        seeds::program = clone_staking_program.clone().unwrap().key(),
    )]
    pub clone_staking: Option<Account<'info, CloneStaking>>,
    #[account(
        seeds = [USER_STAKING_SEED.as_ref(), user.key.as_ref()],
        bump,
        seeds::program = clone_staking_program.clone().unwrap().key(),
    )]
    pub user_staking_account: Option<Account<'info, UserStaking>>,
    pub clone_staking_program: Option<Program<'info, CloneStakingProgram>>,
}

pub fn execute(
    ctx: Context<Swap>,
    pool_index: u8,
    quantity: u64,
    quantity_is_input: bool,
    quantity_is_onusd: bool,
    result_threshold: u64,
) -> Result<()> {
    let seeds = &[&[
        CLONE_PROGRAM_SEED.as_ref(),
        bytemuck::bytes_of(&ctx.accounts.clone.bump),
    ][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let pool = token_data.pools[pool_index as usize];
    let oracle = token_data.oracles[pool.asset_info.oracle_info_index as usize];

    let mut override_liquidity_trading_fee = None;
    let mut override_treasury_trading_fee = None;

    if ctx.accounts.clone_staking.is_some()
        && ctx.accounts.user_staking_account.is_some()
        && ctx.accounts.clone_staking_program.is_some()
    {
        let user_staking_account = ctx.accounts.user_staking_account.as_ref().unwrap();
        let clone_staking = ctx.accounts.clone_staking.as_ref().unwrap();
        if let Some((lp_fees, treasury_fees)) =
            clone_staking.get_tier_fees(user_staking_account.staked_tokens)
        {
            override_liquidity_trading_fee = Some(to_bps_decimal!(lp_fees));
            override_treasury_trading_fee = Some(to_bps_decimal!(treasury_fees));
        }
    }

    check_feed_update(oracle, Clock::get()?.slot)?;

    return_error_if_false!(pool.committed_onusd_liquidity > 0, CloneError::PoolEmpty);

    let user_specified_quantity = to_clone_decimal!(quantity);
    let oracle_price = oracle.get_price();
    let swap_summary = pool.calculate_swap(
        oracle_price,
        user_specified_quantity,
        quantity_is_input,
        quantity_is_onusd,
        override_liquidity_trading_fee,
        override_treasury_trading_fee,
    );

    return_error_if_false!(
        user_specified_quantity > Decimal::ZERO
            && swap_summary.result > Decimal::ZERO
            && swap_summary.liquidity_fees_paid > Decimal::ZERO
            && swap_summary.treasury_fees_paid > Decimal::ZERO,
        CloneError::InvalidTokenAmount
    );

    let threshold = to_clone_decimal!(result_threshold);

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

    token_data.pools[pool_index as usize].onasset_ild += onasset_ild_delta.mantissa() as i64;
    token_data.pools[pool_index as usize].onusd_ild += onusd_ild_delta.mantissa() as i64;

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
        onasset_ild: pool.onasset_ild,
        onusd_ild: pool.onusd_ild,
        committed_onusd_liquidity: pool.committed_onusd_liquidity,
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });
    ctx.accounts.clone.event_counter += 1;

    Ok(())
}
