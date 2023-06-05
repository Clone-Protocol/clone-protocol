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
#[instruction(pool_index: u8, usdi_amount: u64)]
pub struct AddLiquidityToComet<'info> {
    #[account(address = comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept,
        constraint = token_data.load()?.pools[pool_index as usize].deprecated == false @ InceptError::PoolDeprecated
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.comet,
        constraint = comet.load()?.is_single_pool == 0 @ InceptError::WrongCometType
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].liquidity_token_mint,
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<AddLiquidityToComet>, pool_index: u8, usdi_amount: u64) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let pool = token_data.pools[pool_index as usize];
    let _empty_pool = pool.is_empty();

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
            pool.asset_info.price.to_decimal()
        )?;

    let mut lp_tokens_to_mint;
    // find the index of the position within the comet position
    let comet_position_index = comet.get_pool_index(pool_index);

    // check to see if a new position must be added to the position
    if comet_position_index == usize::MAX {
        if comet.is_single_pool == 1 {
            return Err(InceptError::AttemptedToAddNewPoolToSingleComet.into());
        }

        iasset_liquidity_value = rescale_toward_zero(iasset_liquidity_value, DEVNET_TOKEN_SCALE);
        liquidity_token_value = rescale_toward_zero(liquidity_token_value, DEVNET_TOKEN_SCALE);

        comet.add_position(CometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            pool_index: pool_index as u64,
            borrowed_usdi: RawDecimal::from(usdi_liquidity_value),
            borrowed_iasset: RawDecimal::from(iasset_liquidity_value),
            liquidity_token_value: RawDecimal::from(liquidity_token_value),
            comet_liquidation: CometLiquidation {
                ..Default::default()
            },
        });
        lp_tokens_to_mint = liquidity_token_value;
    } else {
        let position = comet.positions[comet_position_index];
        // update comet position data
        let borrowed_usdi = rescale_toward_zero(
            position.borrowed_usdi.to_decimal() + usdi_liquidity_value,
            DEVNET_TOKEN_SCALE,
        );

        let borrowed_iasset = rescale_toward_zero(
            position.borrowed_iasset.to_decimal() + iasset_liquidity_value,
            DEVNET_TOKEN_SCALE,
        );

        liquidity_token_value += position.liquidity_token_value.to_decimal();
        liquidity_token_value = rescale_toward_zero(liquidity_token_value, DEVNET_TOKEN_SCALE);

        lp_tokens_to_mint = liquidity_token_value
            - comet.positions[comet_position_index]
                .liquidity_token_value
                .to_decimal();

        comet.positions[comet_position_index].borrowed_usdi = RawDecimal::from(borrowed_usdi);
        comet.positions[comet_position_index].borrowed_iasset = RawDecimal::from(borrowed_iasset);
        comet.positions[comet_position_index].liquidity_token_value =
            RawDecimal::from(liquidity_token_value);
    }

    iasset_liquidity_value = rescale_toward_zero(iasset_liquidity_value, DEVNET_TOKEN_SCALE);
    lp_tokens_to_mint = rescale_toward_zero(lp_tokens_to_mint, DEVNET_TOKEN_SCALE);

    // mint liquidity into amm
    let cpi_accounts = MintTo {
        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
        to: ctx
            .accounts
            .amm_usdi_token_account
            .to_account_info()
            .clone(),
        authority: ctx.accounts.incept.to_account_info().clone(),
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
        authority: ctx.accounts.incept.to_account_info().clone(),
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
        authority: ctx.accounts.incept.to_account_info().clone(),
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

    // TODO: Might not be needed anymore...
    // let pool = token_data.pools[pool_index as usize];
    // if !empty_pool {
    //     return_error_if_false!(
    //         liquidity_token_value / pool.liquidity_token_supply.to_decimal()
    //             <= pool.asset_info.max_ownership_pct.to_decimal(),
    //         InceptError::MaxPoolOwnershipExceeded
    //     );
    // }
    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, token_data, None)?;

    return_error_if_false!(health_score.is_healthy(), InceptError::HealthScoreTooLow);

    emit!(LiquidityDelta {
        event_id: ctx.accounts.incept.event_counter,
        user: ctx.accounts.user.key(),
        pool_index,
        is_concentrated: true,
        lp_token_delta: lp_tokens_to_mint.mantissa().try_into().unwrap(),
        usdi_delta: usdi_amount as i64,
        iasset_delta: iasset_liquidity_value.mantissa().try_into().unwrap(),
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.incept.event_counter,
        pool_index,
        iasset: ctx.accounts.amm_iasset_token_account.amount,
        usdi: ctx.accounts.amm_usdi_token_account.amount,
        lp_tokens: pool
            .liquidity_token_supply
            .to_decimal()
            .mantissa()
            .try_into()
            .unwrap(),
        oracle_price: oracle_price.mantissa().try_into().unwrap()
    });

    ctx.accounts.incept.event_counter += 1;

    Ok(())
}
