use crate::error::*;
//use crate::instructions::RecenterComet;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user_nonce: u8, manager_nonce: u8, comet_position_index: u8, comet_collateral_index: u8)]
pub struct RecenterComet<'info> {
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce
    )]
    pub user_account: Account<'info, User>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = manager.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = &comet.load()?.owner == user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = (comet_position_index as u64) < comet.load()?.num_positions @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account

    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].liquidity_token_mint
    )]
    pub liquidity_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
        constraint = &vault.mint == &token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].mint
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub struct RecenterResult {
    pub user_usdi_collateral_deficit: Decimal,
    pub user_borrowed_usdi: Decimal,
    pub user_borrowed_iasset: Decimal,
    pub amm_usdi_burn: Decimal,
    pub amm_iasset_burn: Decimal,
}

pub fn recenter_calculation(
    comet: &Comet,
    token_data: &TokenData,
    comet_position_index: usize,
    comet_collateral_index: usize,
) -> Result<RecenterResult> {
    let comet_position = comet.positions[comet_position_index];
    let comet_collateral = comet.collaterals[comet_collateral_index];
    let pool = token_data.pools[comet_position.pool_index as usize];

    let iasset_amm_value = pool.iasset_amount.to_decimal();
    let usdi_amm_value = pool.usdi_amount.to_decimal();

    let liquidity_tokens = comet_position.liquidity_token_value.to_decimal();

    let liquidity_token_supply = pool.liquidity_token_supply.to_decimal();

    // calculate usdi and iasset comet can claim right now
    let (claimable_iasset, claimable_usdi) =
        calculate_liquidity_provider_values_from_liquidity_tokens(
            liquidity_tokens,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();
    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();

    let usdi_ild = borrowed_usdi - claimable_usdi; // If negative its a reward.
    let iasset_ild = borrowed_iasset - claimable_iasset;

    require!(
        !usdi_ild.is_zero() && !iasset_ild.is_zero(),
        InceptError::NoPriceDeviationDetected
    );

    let mut amm_usdi_burn = borrowed_usdi;
    let mut amm_iasset_burn = borrowed_iasset;

    let mut temp_amm_usdi = usdi_amm_value - claimable_usdi;
    let mut temp_amm_iasset = iasset_amm_value - claimable_iasset;
    let temp_k = temp_amm_usdi * temp_amm_iasset;

    let mut collateral_deficit = usdi_ild; // Start off with how much usdi ILD.

    if iasset_ild.is_sign_positive() {
        // Figure out how much usdi required to pay off ILD of iasset.
        let mut usdi_to_pay = temp_k / (temp_amm_iasset - iasset_ild) - temp_amm_usdi;
        usdi_to_pay.rescale(DEVNET_TOKEN_SCALE);
        collateral_deficit += usdi_to_pay;
        temp_amm_usdi += usdi_to_pay;
        temp_amm_iasset -= iasset_ild;
    } else if iasset_ild.is_sign_negative() {
        // Sell your extra iasset.
        let mut usdi_to_receive = temp_amm_usdi - temp_k / (temp_amm_iasset - iasset_ild);
        usdi_to_receive.rescale(DEVNET_TOKEN_SCALE);
        collateral_deficit -= usdi_to_receive;
        temp_amm_usdi -= usdi_to_receive;
        temp_amm_iasset -= iasset_ild;
    }

    let inverse_ratio = liquidity_tokens / (liquidity_token_supply - liquidity_tokens);

    temp_amm_iasset.rescale(DEVNET_TOKEN_SCALE);
    temp_amm_usdi.rescale(DEVNET_TOKEN_SCALE);

    let mut new_borrowed_usdi = temp_amm_usdi * inverse_ratio;
    let mut new_borrowed_iasset = temp_amm_iasset * inverse_ratio;

    new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
    new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

    // We are now minting the new borrowed amounts.
    amm_usdi_burn -= new_borrowed_usdi;
    amm_iasset_burn -= new_borrowed_iasset;

    amm_usdi_burn.rescale(DEVNET_TOKEN_SCALE);
    amm_iasset_burn.rescale(DEVNET_TOKEN_SCALE);
    collateral_deficit.rescale(DEVNET_TOKEN_SCALE);

    Ok(RecenterResult {
        user_usdi_collateral_deficit: collateral_deficit,
        user_borrowed_usdi: new_borrowed_usdi,
        user_borrowed_iasset: new_borrowed_iasset,
        amm_usdi_burn,
        amm_iasset_burn,
    })
}

pub fn execute(
    ctx: Context<RecenterComet>,
    _user_nonce: u8,
    manager_nonce: u8,
    comet_position_index: u8,
    comet_collateral_index: u8,
) -> Result<()> {
    let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut comet = ctx.accounts.comet.load_mut()?;
    let comet_position = comet.positions[comet_position_index as usize];
    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];
    let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();
    // check to see if the collateral used to mint usdi is stable
    let is_stable: Result<bool> = match collateral.stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(InceptError::InvalidBool)),
    };

    // if collateral is not stable, we throw an error
    require!(is_stable?, InceptError::InvalidCollateralType);

    let recenter_result = recenter_calculation(
        &comet,
        &**token_data,
        comet_position_index as usize,
        comet_collateral_index as usize,
    )?;

    // Update borrowed positions.
    comet.positions[comet_position_index as usize].borrowed_usdi =
        RawDecimal::from(recenter_result.user_borrowed_usdi);
    comet.positions[comet_position_index as usize].borrowed_iasset =
        RawDecimal::from(recenter_result.user_borrowed_iasset);

    // Burn or mint for amm
    if recenter_result.amm_usdi_burn.is_sign_positive() {
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
            recenter_result.amm_usdi_burn.mantissa()
        );
        } else {
            let mut vault_usdi_supply =
                collateral.vault_usdi_supply.to_decimal() + recentering_fee_collateral_scale;
            vault_usdi_supply.rescale(DEVNET_TOKEN_SCALE);
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
                RawDecimal::from(vault_usdi_supply);
        }

    // subtract the collateral the user paid from the position
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::from(
            collateral.vault_comet_supply.to_decimal() - recentering_fee_collateral_scale,
        );
    comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
        comet_collateral.collateral_amount.to_decimal() - recentering_fee_collateral_scale,
    );

    // mint usdi into amm
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
    usdi_amount.rescale(DEVNET_TOKEN_SCALE);
    token::mint_to(
        mint_usdi_context,
        usdi_amount.mantissa().try_into().unwrap(),
    )?;

    if recenter_result.amm_iasset_burn.is_sign_positive() {
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
            recenter_result
                .amm_iasset_burn
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    } else if recenter_result.amm_iasset_burn.is_sign_negative() {
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                MintTo {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            recenter_result
                .amm_iasset_burn
                .abs()
                .mantissa()
                .try_into()
                .unwrap(),
        )?;
    }

    // Update collateral.
    let mut new_collateral_amount = comet_collateral.collateral_amount.to_decimal()
        - recenter_result.user_usdi_collateral_deficit;
    new_collateral_amount.rescale(DEVNET_TOKEN_SCALE);
    comet.collaterals[comet_collateral_index as usize].collateral_amount =
        RawDecimal::from(new_collateral_amount);

    let using_usdi_collateral = comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX;

    if recenter_result
        .user_usdi_collateral_deficit
        .is_sign_positive()
    {
        // If collateral is USDi Transfer from vault to amm.
        // Else mint usdi into amm.
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
                recenter_result
                    .user_usdi_collateral_deficit
                    .mantissa()
                    .try_into()
                    .unwrap(),
            )?;
        } else {
            let vault_usdi_supply =
                collateral.vault_usdi_supply.to_decimal() - recentering_fee_collateral_scale;
            // add to the amount of collateral backing usdi
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
                RawDecimal::from(vault_usdi_supply);
        }

        let mut vault_comet_supply = collateral.vault_comet_supply.to_decimal() - recentering_fee;
        vault_comet_supply.rescale(DEVNET_TOKEN_SCALE);
        // subtract the collateral the user paid from the position
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            RawDecimal::from(vault_comet_supply);

        let collateral_amount =
            comet_collateral.collateral_amount.to_decimal() - recentering_fee_collateral_scale;
        comet.collaterals[comet_collateral_index as usize].collateral_amount =
            RawDecimal::from(collateral_amount);

        // mint iasset into amm
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
        iasset_surplus.rescale(DEVNET_TOKEN_SCALE);
        token::mint_to(
            mint_iasset_context,
            iasset_surplus.mantissa().try_into().unwrap(),
        )?;

        // burn usdi from amm
        let cpi_accounts = Burn {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            from: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };

        let burn_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );
        usdi_burned.rescale(DEVNET_TOKEN_SCALE);

        token::burn(
            burn_usdi_context,
            usdi_burned.mantissa().try_into().unwrap(),
        )?;
    } else {
        return Err(InceptError::NoPriceDeviationDetected.into());
    }

    // update pool data
    ctx.accounts.amm_iasset_token_account.reload()?;
    ctx.accounts.amm_usdi_token_account.reload()?;
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
    token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
        RawDecimal::new(
            ctx.accounts.vault.amount.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

    Ok(())
}
