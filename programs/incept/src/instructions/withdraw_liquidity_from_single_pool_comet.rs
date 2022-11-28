use crate::error::*;
//use crate::instructions::WithdrawLiquidityFromSinglePoolComet;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user_nonce: u8, manager_nonce: u8, liquidity_token_amount: u64, position_index: u8)]
pub struct WithdrawLiquidityFromSinglePoolComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.single_pool_comets,
        constraint = single_pool_comet.load()?.num_positions > position_index as u64,
        constraint = &single_pool_comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = single_pool_comet.load()?.is_single_pool == 1 @ InceptError::NotSinglePoolComet
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
    #[account(
        mut,
        address = token_data.load()?.collaterals[single_pool_comet.load()?.collaterals[position_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<WithdrawLiquidityFromSinglePoolComet>,
    _user_nonce: u8,
    manager_nonce: u8,
    liquidity_token_amount: u64,
    position_index: u8,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut single_pool_comet = ctx.accounts.single_pool_comet.load_mut()?;
    let comet_position = single_pool_comet.positions[position_index as usize];
    let comet_collateral = single_pool_comet.collaterals[position_index as usize];
    let comet_liquidity_tokens = comet_position.liquidity_token_value.to_decimal();

    let liquidity_token_value = Decimal::new(
        liquidity_token_amount.try_into().unwrap(),
        DEVNET_TOKEN_SCALE,
    )
    .min(comet_liquidity_tokens);

    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    // check to see if the collateral used to mint usdi is stable
    let is_stable: Result<bool> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(InceptError::InvalidBool)),
    };

    // if collateral is not stable, we throw an error
    require!(is_stable?, InceptError::InvalidCollateralType);

    // require!(
    //     liquidity_token_value <= comet_position.liquidity_token_value.to_decimal(),
    //     InceptError::InvalidTokenAccountBalance
    // );

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

    let claimable_ratio = liquidity_token_value / liquidity_token_supply;

    let usdi_borrowed = comet_position.borrowed_usdi.to_decimal();
    let iasset_borrowed = comet_position.borrowed_iasset.to_decimal();

    // calculate initial comet pool price
    let initial_comet_price = calculate_amm_price(iasset_borrowed, usdi_borrowed);
    // calculate current pool price
    let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

    // Check that position price is within 1 tick size of comet price
    let tick_size = Decimal::new(1, 2);
    require!(
        (current_price - initial_comet_price).abs() < tick_size,
        InceptError::CenteredCometRequired
    );

    // Check that after withdrawal there is not a one sided-position
    let claimable_usdi = claimable_ratio * usdi_amm_value;
    let claimable_iasset = claimable_ratio * iasset_amm_value;

    let borrowed_position_remains =
        claimable_usdi < usdi_borrowed && claimable_iasset < iasset_borrowed;
    let borrowed_position_paid_off =
        claimable_usdi >= usdi_borrowed && claimable_iasset >= iasset_borrowed;
    let claiming_all_liquidity = liquidity_token_value == comet_liquidity_tokens;

    require!(
        borrowed_position_remains || borrowed_position_paid_off || claiming_all_liquidity,
        InceptError::InvalidResultingComet
    );

    let mut usdi_burn_amount: Decimal;
    let mut iasset_burn_amount: Decimal;

    if borrowed_position_remains {
        // If there is a position leftover, check that the new price is still within one tick.
        let new_usdi_borrowed = usdi_borrowed - claimable_usdi;
        let new_iasset_borrowed = iasset_borrowed - claimable_iasset;
        let new_price = calculate_amm_price(new_iasset_borrowed, new_usdi_borrowed);
        require!(
            (current_price - new_price).abs() < tick_size,
            InceptError::InvalidResultingComet
        );

        // Decrease borrowed positions
        single_pool_comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::from(new_usdi_borrowed);
        single_pool_comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::from(new_iasset_borrowed);
        // Decrease liquidity tokens
        single_pool_comet.positions[position_index as usize].liquidity_token_value =
            RawDecimal::from(
                comet_position.liquidity_token_value.to_decimal() - liquidity_token_value,
            );

        usdi_burn_amount = claimable_usdi;
        iasset_burn_amount = claimable_iasset;
    } else {
        // Position is paid with rewards.
        let mut usdi_reward = claimable_usdi - usdi_borrowed;
        let iasset_reward = claimable_iasset - iasset_borrowed;

        let temp_usdi_amm = usdi_amm_value - claimable_usdi;
        let temp_iasset_amm = iasset_amm_value - claimable_iasset;
        let temp_k = temp_usdi_amm * temp_iasset_amm;

        if iasset_reward.is_sign_positive() {
            let additional_usdi_reward = temp_usdi_amm - temp_k / (temp_iasset_amm + iasset_reward);
            usdi_reward += additional_usdi_reward;
        } else if iasset_reward.is_sign_negative() {
            let additional_usdi_cost = temp_k / (temp_iasset_amm + iasset_reward) - temp_iasset_amm;
            usdi_reward -= additional_usdi_cost;
        }

        let using_usdi_collateral =
            comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX;

        usdi_reward.rescale(DEVNET_TOKEN_SCALE);

        single_pool_comet.collaterals[position_index as usize].collateral_amount = RawDecimal::from(
            single_pool_comet.collaterals[position_index as usize]
                .collateral_amount
                .to_decimal()
                + usdi_reward,
        );

        if usdi_reward.is_sign_positive() {
            // Transfer reward from amm to vault.
            if using_usdi_collateral {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info().clone(),
                        Transfer {
                            from: ctx
                                .accounts
                                .amm_usdi_token_account
                                .to_account_info()
                                .clone(),
                            to: ctx.accounts.vault.to_account_info().clone(),
                            authority: ctx.accounts.manager.to_account_info().clone(),
                        },
                        seeds,
                    ),
                    usdi_reward.mantissa().try_into().unwrap(),
                )?;
            } else {
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
                    usdi_reward.mantissa().try_into().unwrap(),
                )?;
            }
        } else if usdi_reward.is_sign_negative() {
            // Transfer reward from vault to amm.
            if using_usdi_collateral {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info().clone(),
                        Transfer {
                            from: ctx.accounts.vault.to_account_info().clone(),
                            to: ctx
                                .accounts
                                .amm_usdi_token_account
                                .to_account_info()
                                .clone(),
                            authority: ctx.accounts.manager.to_account_info().clone(),
                        },
                        seeds,
                    ),
                    usdi_reward.abs().mantissa().try_into().unwrap(),
                )?;
            } else {
                token::mint_to(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info().clone(),
                        MintTo {
                            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                            to: ctx
                                .accounts
                                .amm_usdi_token_account
                                .to_account_info()
                                .clone(),
                            authority: ctx.accounts.manager.to_account_info().clone(),
                        },
                        seeds,
                    ),
                    usdi_reward.abs().mantissa().try_into().unwrap(),
                )?;
            }
        }

        // Set borrowed positions to zero
        single_pool_comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);
        single_pool_comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::new(0, DEVNET_TOKEN_SCALE);

        // Decrease liquidity tokens
        single_pool_comet.positions[position_index as usize].liquidity_token_value =
            RawDecimal::from(
                comet_position.liquidity_token_value.to_decimal() - liquidity_token_value,
            );

        // Burn the rest which is just the borrowed amounts
        usdi_burn_amount = usdi_borrowed;
        iasset_burn_amount = iasset_borrowed; // Equal to claimable_iasset - initial_iasset_reward
    }

    // Burn claim from pools
    iasset_burn_amount.rescale(DEVNET_TOKEN_SCALE);
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
        iasset_burn_amount.mantissa().try_into().unwrap(),
    )?;

    usdi_burn_amount.rescale(DEVNET_TOKEN_SCALE);
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
        usdi_burn_amount.mantissa().try_into().unwrap(),
    )?;

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
        liquidity_token_value.mantissa().try_into().unwrap(),
    )?;

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

    Ok(())
}
