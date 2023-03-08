use crate::error::*;
use crate::events::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(liquidity_token_amount: u64, position_index: u8)]
pub struct WithdrawLiquidityFromSinglePoolComet<'info> {
    #[account(address = single_pool_comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data,
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.single_pool_comets,
        constraint = single_pool_comet.load()?.num_positions > position_index as u64,
        constraint = single_pool_comet.load()?.is_single_pool == 1 @ InceptError::WrongCometType
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.usdi_mint
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
    #[account(
        mut,
        address = token_data.load()?.collaterals[single_pool_comet.load()?.collaterals[position_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromSinglePoolComet>,
    liquidity_token_amount: u64,
    position_index: u8,
) -> Result<()> {
    let seeds = &[&[b"incept", bytemuck::bytes_of(&ctx.accounts.incept.bump)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut single_pool_comet = ctx.accounts.single_pool_comet.load_mut()?;
    let comet_position = single_pool_comet.positions[position_index as usize];
    let comet_collateral = single_pool_comet.collaterals[position_index as usize];
    let comet_liquidity_tokens = comet_position.liquidity_token_value.to_decimal();
    let pool_index = comet_position.pool_index;

    return_error_if_false!(
        comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX,
        InceptError::InvalidCollateralType
    );

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

    let lp_position_claimable_ratio = liquidity_token_value / liquidity_token_supply;

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

    let claimable_usdi = lp_position_claimable_ratio * usdi_amm_value;
    let claimable_iasset = lp_position_claimable_ratio * iasset_amm_value;

    let mut usdi_reward = Decimal::zero();
    let mut usdi_to_burn = Decimal::zero();
    let mut iasset_to_burn = Decimal::zero();

    if claimable_usdi > borrowed_usdi {
        usdi_to_burn += borrowed_usdi;
        // Claim USDi reward
        usdi_reward += claimable_usdi - borrowed_usdi;
        // Set borrowed USDi to zero.
        single_pool_comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
    } else {
        usdi_to_burn += claimable_usdi;
        let mut new_borrowed_usdi = borrowed_usdi - claimable_usdi;
        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
        single_pool_comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);
    }

    if claimable_iasset > borrowed_iasset {
        iasset_to_burn += borrowed_iasset;
        // Calculate iasset reward and its conversion to usdi.
        let iasset_reward = claimable_iasset - borrowed_iasset;

        let post_claim_usdi_amm = usdi_amm_value - claimable_usdi;
        let post_claim_iasset_amm = iasset_amm_value - claimable_iasset;
        let invariant = post_claim_usdi_amm * post_claim_iasset_amm;

        let usdi_traded_for =
            post_claim_usdi_amm - invariant / (post_claim_iasset_amm + iasset_reward);
        usdi_reward += usdi_traded_for;

        single_pool_comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
    } else {
        iasset_to_burn += claimable_iasset;
        let mut new_borrowed_iasset = borrowed_iasset - claimable_iasset;
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        single_pool_comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);
    }

    // Send usdi reward from amm to collateral vault
    if usdi_reward > Decimal::ZERO {
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx.accounts.vault.to_account_info().clone(),
            authority: ctx.accounts.incept.to_account_info().clone(),
        };
        let transfer_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        usdi_reward.rescale(DEVNET_TOKEN_SCALE);
        token::transfer(
            transfer_usdi_context,
            usdi_reward.mantissa().try_into().unwrap(),
        )?;

        let mut new_usdi_collateral = comet_collateral.collateral_amount.to_decimal() + usdi_reward;
        new_usdi_collateral.rescale(DEVNET_TOKEN_SCALE);
        single_pool_comet.collaterals[position_index as usize].collateral_amount =
            RawDecimal::from(new_usdi_collateral);
    }

    // Burn Usdi from amm
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
        let burn_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        usdi_to_burn.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_usdi_context,
            usdi_to_burn.mantissa().try_into().unwrap(),
        )?;
    }

    // Burn iasset from amm
    if iasset_to_burn > Decimal::ZERO {
        let cpi_accounts = Burn {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            from: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.incept.to_account_info().clone(),
        };
        let burn_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        iasset_to_burn.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_iasset_context,
            iasset_to_burn.mantissa().try_into().unwrap(),
        )?;
    }
    // burn liquidity tokens from comet
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
    let mut new_comet_liquidity_tokens = comet_liquidity_tokens - liquidity_token_value;
    new_comet_liquidity_tokens.rescale(DEVNET_TOKEN_SCALE);
    single_pool_comet.positions[position_index as usize].liquidity_token_value =
        RawDecimal::from(new_comet_liquidity_tokens);

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
    ctx.accounts.liquidity_token_mint.reload()?;
    ctx.accounts.vault.reload()?;

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
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::new(
            ctx.accounts.vault.amount.try_into().unwrap(),
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
    let mut oracle_price = pool.asset_info.price.to_decimal();
    oracle_price.rescale(DEVNET_TOKEN_SCALE);

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
