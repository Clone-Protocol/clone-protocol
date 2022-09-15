use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use jupiter_agg_mock::cpi::accounts::Swap;
use jupiter_agg_mock::cpi::swap as CpiJupiterSwap;
use jupiter_agg_mock::program::JupiterAggMock;
use jupiter_agg_mock::Jupiter;
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, user_nonce: u8, jupiter_nonce: u8, position_index: u8, asset_index: u8, comet_collateral_index: u8, il_reduction_amount: u64)]
pub struct LiquidateCometILReduction<'info> {
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data
    )]
    pub manager: Box<Account<'info, Manager>>,
    #[account(
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub user: AccountInfo<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
        has_one = comet,
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
        associated_token::mint = usdi_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[comet.load()?.collaterals[comet_collateral_index as usize].collateral_index as usize].vault,
   )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub jupiter_program: Program<'info, JupiterAggMock>,
    pub jupiter_account: AccountLoader<'info, Jupiter>,
    #[account(
        mut,
        address = token_data.load()?.collaterals[USDC_COLLATERAL_INDEX].vault,
   )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        address = jupiter_account.load()?.asset_mints[asset_index as usize],
    )]
    pub asset_mint: Account<'info, Mint>,
    #[account(mut,
        address = jupiter_account.load()?.usdc_mint
    )]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        address = jupiter_account.load()?.oracles[asset_index as usize]
    )]
    pub pyth_oracle: AccountInfo<'info>,
}

pub fn execute(
    ctx: Context<LiquidateCometILReduction>,
    manager_nonce: u8,
    _user_nonce: u8,
    jupiter_nonce: u8,
    position_index: u8,
    asset_index: u8,
    comet_collateral_index: u8,
    il_reduction_amount: u64,
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

    // Check that all LP positions are zero, also if there are USDi LP positions.
    let mut exists_usdi_il = false;
    for i in 0..comet.num_positions {
        let position = comet.positions[i as usize];

        if !position.liquidity_token_value.to_decimal().is_zero() {
            return Err(InceptError::NotSubjectToILLiquidation.into());
        }
        if position.borrowed_usdi.to_decimal() > position.borrowed_iasset.to_decimal() {
            exists_usdi_il = true;
        }
    }
    // Look at current position:
    let position = comet.positions[position_index as usize];
    let borrowed_usdi = position.borrowed_usdi.to_decimal();
    let borrowed_iasset = position.borrowed_iasset.to_decimal();

    let init_price = borrowed_usdi / borrowed_iasset;
    let pool = token_data.pools[position.pool_index as usize];

    let pool_price = pool.usdi_amount.to_decimal() / pool.iasset_amount.to_decimal();

    let position_is_usdi_il = init_price > pool_price;

    if !position_is_usdi_il && exists_usdi_il {
        return Err(InceptError::NotSubjectToILLiquidation.into());
    }

    let comet_collateral = comet.collaterals[comet_collateral_index as usize];
    let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

    let is_stable_collateral = collateral.stable == 1;

    if position_is_usdi_il {
        let impermanent_loss_usdi = position.borrowed_usdi.to_decimal();

        require!(
            il_reduction_amount <= impermanent_loss_usdi.mantissa().try_into().unwrap(),
            InceptError::LiquidationAmountTooLarge
        );

        let liquidation_value = Decimal::new(
            il_reduction_amount.try_into().unwrap(),
            impermanent_loss_usdi.scale().try_into().unwrap(),
        );
        let mut total_usdi_required =
            liquidation_value * token_data.il_liquidation_reward_pct.to_decimal();
        let usdi_reward = total_usdi_required - liquidation_value;

        // remove total_usdi_required from comet, comet collateral and token data
        if is_stable_collateral {
            comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
                comet_collateral.collateral_amount.to_decimal() - total_usdi_required,
            );
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(collateral.vault_comet_supply.to_decimal() - total_usdi_required);

            // Vault usdi supply
            // Burn USDi from vault.
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        from: ctx.accounts.vault.to_account_info().clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                total_usdi_required.mantissa().try_into().unwrap(),
            )?;
        } else {
            // Trade users non-stable collateral for usdc,
            // Using non-stable collateral vault and the usdc vault:
            // Swap as much collateral out of vault needed to get total_required_usdi amount of usdc into usdc vault.
            let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();
            let starting_vault_collateral = Decimal::new(
                ctx.accounts.vault.amount.try_into().unwrap(),
                collateral_scale,
            );

            let mut signer_manager = ctx.accounts.manager.to_account_info().clone();
            signer_manager.is_signer = true;

            let cpi_program = ctx.accounts.jupiter_program.to_account_info();
            let cpi_accounts = Swap {
                user: signer_manager,
                jupiter_account: ctx.accounts.jupiter_account.to_account_info(),
                asset_mint: ctx.accounts.asset_mint.to_account_info(),
                usdc_mint: ctx.accounts.usdc_mint.to_account_info(),
                user_asset_token_account: ctx.accounts.vault.to_account_info(),
                user_usdc_token_account: ctx.accounts.usdc_vault.to_account_info(),
                pyth_oracle: ctx.accounts.pyth_oracle.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);
            total_usdi_required.rescale(DEVNET_TOKEN_SCALE);
            CpiJupiterSwap(
                cpi_ctx,
                jupiter_nonce,
                asset_index,
                false,
                false,
                total_usdi_required.mantissa().try_into().unwrap(),
            )?;

            ctx.accounts.vault.reload()?;

            let final_vault_collateral = Decimal::new(
                ctx.accounts.vault.amount.try_into().unwrap(),
                collateral_scale,
            );
            let collateral_reduction = starting_vault_collateral - final_vault_collateral;

            comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
                comet_collateral.collateral_amount.to_decimal() - collateral_reduction,
            );

            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(collateral.vault_comet_supply.to_decimal() - collateral_reduction);
        }

        // reduce borrowed_usdi by il value
        comet.positions[position_index as usize].borrowed_usdi =
            RawDecimal::from(position.borrowed_usdi.to_decimal() - liquidation_value);

        // Mint and reward liquidator with usdi_reward.
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
        let impermanent_loss_iasset = position.borrowed_iasset.to_decimal();

        require!(
            il_reduction_amount <= impermanent_loss_iasset.mantissa().try_into().unwrap(),
            InceptError::LiquidationAmountTooLarge
        );

        let mut liquidation_value = Decimal::new(
            il_reduction_amount.try_into().unwrap(),
            impermanent_loss_iasset.scale().try_into().unwrap(),
        );

        // calculate how much usdi must be spent
        let mut impermanent_loss_usdi = calculate_price_from_iasset(
            liquidation_value,
            pool.iasset_amount.to_decimal(),
            pool.usdi_amount.to_decimal(),
            true,
        )?;

        let mut total_usdi_required =
            impermanent_loss_usdi * token_data.il_liquidation_reward_pct.to_decimal();
        let mut usdi_reward = total_usdi_required - impermanent_loss_usdi;

        if is_stable_collateral {
            let mut new_collateral_amount =
                comet_collateral.collateral_amount.to_decimal() - total_usdi_required;
            new_collateral_amount.rescale(DEVNET_TOKEN_SCALE);
            comet.collaterals[comet_collateral_index as usize].collateral_amount =
                RawDecimal::from(new_collateral_amount);

            let mut new_vault_comet_supply =
                collateral.vault_comet_supply.to_decimal() - total_usdi_required;
            new_vault_comet_supply.rescale(DEVNET_TOKEN_SCALE);

            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(new_vault_comet_supply);

            total_usdi_required.rescale(DEVNET_TOKEN_SCALE);
            // Burn USDi from vault.
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        from: ctx.accounts.vault.to_account_info().clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                total_usdi_required.mantissa().try_into().unwrap(),
            )?;
        } else {
            let collateral_scale = collateral.vault_comet_supply.to_decimal().scale();
            let starting_vault_collateral = Decimal::new(
                ctx.accounts.vault.amount.try_into().unwrap(),
                collateral_scale,
            );

            let mut signer_manager = ctx.accounts.manager.to_account_info().clone();
            signer_manager.is_signer = true;

            let cpi_program = ctx.accounts.jupiter_program.to_account_info();
            let cpi_accounts = Swap {
                user: signer_manager,
                jupiter_account: ctx.accounts.jupiter_account.to_account_info(),
                asset_mint: ctx.accounts.asset_mint.to_account_info(),
                usdc_mint: ctx.accounts.usdc_mint.to_account_info(),
                user_asset_token_account: ctx.accounts.vault.to_account_info(),
                user_usdc_token_account: ctx.accounts.usdc_vault.to_account_info(),
                pyth_oracle: ctx.accounts.pyth_oracle.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds);
            total_usdi_required.rescale(DEVNET_TOKEN_SCALE);
            CpiJupiterSwap(
                cpi_ctx,
                jupiter_nonce,
                asset_index,
                false,
                false,
                total_usdi_required.mantissa().try_into().unwrap(),
            )?;

            ctx.accounts.vault.reload()?;

            let final_vault_collateral = Decimal::new(
                ctx.accounts.vault.amount.try_into().unwrap(),
                collateral_scale,
            );
            let collateral_reduction = starting_vault_collateral - final_vault_collateral;

            comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
                comet_collateral.collateral_amount.to_decimal() - collateral_reduction,
            );

            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(collateral.vault_comet_supply.to_decimal() - collateral_reduction);
        }

        // Mint USDi into AMM
        impermanent_loss_usdi.rescale(DEVNET_TOKEN_SCALE);
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
            impermanent_loss_usdi.mantissa().try_into().unwrap(),
        )?;

        // Burn IAsset from AMM
        liquidation_value.rescale(DEVNET_TOKEN_SCALE);
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
            liquidation_value.mantissa().try_into().unwrap(),
        )?;

        // Reduce borrowed IAsset since it's paid down.
        let mut new_borrowed_iasset = position.borrowed_iasset.to_decimal() - liquidation_value;
        new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_iasset);

        // Mint usdi reward to liquidator
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
    }

    let resulting_score = match calculate_health_score(&comet, &token_data)? {
        HealthScore::Healthy { score } => score,
        HealthScore::SubjectToLiquidation { score } => score,
    };

    require!(
        resulting_score <= 20f64,
        InceptError::LiquidationAmountTooLarge
    );

    Ok(())
}
