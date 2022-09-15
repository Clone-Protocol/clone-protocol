use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, user_nonce: u8, position_index: u8, lp_token_reduction: u64)]
pub struct LiquidateCometPositionReduction<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
        has_one = comet
    )]
    pub user_account: Box<Account<'info, User>>,
    #[account(
        mut,
        constraint = comet.load()?.owner == user_account.authority @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > position_index.into() @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].usdi_token_account,
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].iasset_token_account,
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].comet_liquidity_token_account,
    )]
    pub comet_liquidity_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[position_index as usize].pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = iasset_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdi_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_usdi_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<LiquidateCometPositionReduction>,
    manager_nonce: u8,
    _user_nonce: u8,
    position_index: u8,
    lp_token_reduction: u64,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

    let mut token_data = ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    // Require a healthy score after transactions
    let health_score = calculate_health_score(&comet, &token_data)?;

    require!(
        matches!(health_score, HealthScore::SubjectToLiquidation { .. }),
        InceptError::NotSubjectToLiquidation
    );

    let comet_position = comet.positions[position_index as usize];

    require!(
        comet_position.borrowed_usdi.to_decimal().is_sign_positive(),
        InceptError::NotSubjectToLiquidation
    );

    let pool = token_data.pools[comet_position.pool_index as usize];
    let pool_usdi_amount = pool.usdi_amount.to_decimal();
    let pool_iasset_amount = pool.iasset_amount.to_decimal();

    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();
    let liquidity_token_value = comet_position.liquidity_token_value.to_decimal();

    let pool_price = pool_usdi_amount / pool_iasset_amount;
    let init_price = borrowed_usdi / borrowed_iasset;

    require!(
        lp_token_reduction
            <= comet_position
                .liquidity_token_value
                .to_decimal()
                .mantissa()
                .try_into()
                .unwrap(),
        InceptError::LiquidationAmountTooLarge
    );

    let mut lp_token_reduction = Decimal::new(
        lp_token_reduction.try_into().unwrap(),
        comet_position
            .liquidity_token_value
            .to_decimal()
            .scale()
            .try_into()
            .unwrap(),
    );

    let liquidity_token_supply = pool.liquidity_token_supply.to_decimal();

    let mut usdi_reduction_amount = lp_token_reduction * pool_usdi_amount / liquidity_token_supply;

    let mut iasset_reduction_amount =
        lp_token_reduction * pool_iasset_amount / liquidity_token_supply;

    // Calculate amounts to burn for LP tokens, usdi and iAsset
    if pool_price > init_price {
        // Price went up, IL in iAsset, burn all iasset and reward some usdi
        let usdi_position_reduction = lp_token_reduction / liquidity_token_value * borrowed_usdi;
        let mut usdi_reward = usdi_reduction_amount - usdi_position_reduction;

        let iasset_position_reduction = iasset_reduction_amount.min(borrowed_iasset);

        // Remove from borrowed positions
        let mut new_borrowed_usdi = borrowed_usdi - usdi_position_reduction;
        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

        let mut new_borrowed_iasset = borrowed_iasset - iasset_position_reduction;
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

        comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);
        comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);

        // Mint usdi reward and give to liquidator,
        usdi_reward.rescale(DEVNET_TOKEN_SCALE);
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .liquidator_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            usdi_reward.mantissa().try_into().unwrap(),
        )?;
    } else {
        // Price went down, IL in USDi. burn all usdi and reward some iasset
        let iasset_position_reduction =
            (lp_token_reduction / liquidity_token_value) * borrowed_iasset;
        let mut iasset_reward = iasset_reduction_amount - iasset_position_reduction;

        let usdi_position_reduction = usdi_reduction_amount.min(borrowed_usdi);

        let mut new_borrowed_usdi = borrowed_usdi - usdi_position_reduction;
        new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

        let mut new_borrowed_iasset = borrowed_iasset - iasset_position_reduction;
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

        // Remove from borrowed positions
        comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_usdi);
        comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);

        // Mint iasset reward and give to liquidator,
        iasset_reward.rescale(DEVNET_TOKEN_SCALE);
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .liquidator_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            iasset_reward.mantissa().try_into().unwrap(),
        )?;
    }
    let mut new_liquidity_token_value = liquidity_token_value - lp_token_reduction;
    new_liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
    // Remove LP tokens from position.
    comet.positions[position_index as usize].liquidity_token_value =
        RawDecimal::from(new_liquidity_token_value);

    // Burn USDi, iAsset and LP from pool
    usdi_reduction_amount.rescale(DEVNET_TOKEN_SCALE);
    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .amm_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            },
            seeds,
        ),
        usdi_reduction_amount.mantissa().try_into().unwrap(),
    )?;

    iasset_reduction_amount.rescale(DEVNET_TOKEN_SCALE);
    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            },
            seeds,
        ),
        iasset_reduction_amount.mantissa().try_into().unwrap(),
    )?;

    lp_token_reduction.rescale(DEVNET_TOKEN_SCALE);
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
                authority: ctx.accounts.manager.to_account_info().clone(),
            },
            seeds,
        ),
        lp_token_reduction.mantissa().try_into().unwrap(),
    )?;
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

    let total_collateral_amount = comet.get_total_collateral_amount();
    let position_term = (borrowed_usdi * pool.asset_info.health_score_coefficient.to_decimal()
        / total_collateral_amount)
        .to_f64()
        .unwrap();

    let resulting_score = match health_score {
        HealthScore::Healthy { score } => score + position_term,
        HealthScore::SubjectToLiquidation { score } => score + position_term,
    };

    require!(
        resulting_score
            < token_data
                .il_health_score_cutoff
                .to_decimal()
                .to_f64()
                .unwrap(),
        InceptError::LiquidationAmountTooLarge
    );

    Ok(())
}
