use crate::error::*;
use crate::events::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, liquidity_token_amount: u64)]
pub struct WithdrawLiquidityFromComet<'info> {
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
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet || comet.to_account_info().key() == user_account.single_pool_comets,
        constraint = comet.load()?.is_single_pool == 0 || comet.load()?.is_single_pool == 1 @ InceptError::WrongCometType,
        constraint = (comet_position_index as u64) < comet.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].liquidity_token_mint,
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = user,
    )]
    pub user_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = user,
    )]
    pub user_usdi_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromComet>,
    comet_position_index: u8,
    liquidity_token_amount: u64,
) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_position = comet.positions[comet_position_index as usize];
    let pool_index = comet_position.pool_index;
    let comet_liquidity_tokens = comet_position.liquidity_token_value.to_decimal();

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    )
    .min(comet_liquidity_tokens);

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

    let lp_position_claimable_ratio = calculate_liquidity_proportion_from_liquidity_tokens(
        liquidity_token_value,
        liquidity_token_supply,
    );

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

    let claimable_usdi = rescale_toward_zero(
        lp_position_claimable_ratio * usdi_amm_value,
        DEVNET_TOKEN_SCALE,
    );
    let claimable_iasset = rescale_toward_zero(
        lp_position_claimable_ratio * iasset_amm_value,
        DEVNET_TOKEN_SCALE,
    );

    let (mut usdi_to_burn, mut usdi_reward) = if claimable_usdi > borrowed_usdi {
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
        (borrowed_usdi, claimable_usdi - borrowed_usdi)
    } else {
        let new_borrowed_usdi =
            rescale_toward_zero(borrowed_usdi - claimable_usdi, DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);
        (claimable_usdi, Decimal::zero())
    };

    let (mut iasset_to_burn, mut iasset_reward) = if claimable_iasset > borrowed_iasset {
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
        (borrowed_iasset, claimable_iasset - borrowed_iasset)
    } else {
        let new_borrowed_iasset =
            rescale_toward_zero(borrowed_iasset - claimable_iasset, DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);
        (claimable_iasset, Decimal::zero())
    };

    // Send usdi reward from amm to user
    usdi_reward = rescale_toward_zero(usdi_reward, DEVNET_TOKEN_SCALE);
    if usdi_reward > Decimal::ZERO {
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
        let transfer_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::transfer(
            transfer_usdi_context,
            usdi_reward.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn Usdi from amm
    usdi_to_burn = rescale_toward_zero(usdi_to_burn, DEVNET_TOKEN_SCALE);
    if usdi_to_burn > Decimal::ZERO {
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.incept.to_account_info().clone(),
        };
        let burn_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::burn(
            burn_iasset_context,
            usdi_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    // Send iasset reward from amm to user
    iasset_reward = rescale_toward_zero(iasset_reward, DEVNET_TOKEN_SCALE);
    if iasset_reward > Decimal::ZERO {
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
        let transfer_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        token::transfer(
            transfer_iasset_context,
            iasset_reward.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn iasset from amm
    iasset_to_burn = rescale_toward_zero(iasset_to_burn, DEVNET_TOKEN_SCALE);
    if iasset_to_burn > Decimal::ZERO {
        let burn_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.incept.to_account_info().clone(),
            },
            seeds,
        );
        token::burn(
            burn_iasset_context,
            iasset_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn LP tokens.
    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.incept.to_account_info().clone(),
            },
            seeds,
        ),
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

    // Remove lp tokens from user
    let new_comet_liquidity_tokens = rescale_toward_zero(
        comet_liquidity_tokens - liquidity_token_value,
        DEVNET_TOKEN_SCALE,
    );
    comet.positions[comet_position_index as usize].liquidity_token_value =
        RawDecimal::from(new_comet_liquidity_tokens);

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;

    token_data.pools[comet_position.pool_index as usize].iasset_amount = RawDecimal::new(
        ctx.accounts
            .amm_iasset_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[comet_position.pool_index as usize].usdi_amount = RawDecimal::new(
        ctx.accounts
            .amm_usdi_token_account
            .amount
            .try_into()
            .unwrap(),
        DEVNET_TOKEN_SCALE,
    );
    token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = RawDecimal::new(
        ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    );

    emit!(LiquidityDelta {
        event_id: ctx.accounts.incept.event_counter,
        user: ctx.accounts.user.key(),
        pool_index: pool_index.try_into().unwrap(),
        is_concentrated: true,
        lp_token_delta: -(liquidity_token_value.mantissa() as i64),
        usdi_delta: -(usdi_to_burn.mantissa() as i64),
        iasset_delta: -(iasset_to_burn.mantissa() as i64),
    });

    let pool = token_data.pools[pool_index as usize];
    let oracle_price = rescale_toward_zero(pool.asset_info.price.to_decimal(), DEVNET_TOKEN_SCALE);

    emit!(PoolState {
        event_id: ctx.accounts.incept.event_counter,
        pool_index: pool_index.try_into().unwrap(),
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
