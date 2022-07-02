use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use anchor_spl::token::{self, Burn, MintTo, Transfer};
use chainlink_solana as chainlink;
use error::*;
use instructions::*;
use pyth::pc::Price;
use states::{
    AssetInfo, Collateral, CometCollateral, CometLiquidation, CometPosition, LiquidationStatus,
    LiquidityPosition, MintPosition, Pool, TokenData, Value,
};

mod error;
mod instructions;
mod math;
mod states;
mod value;

use crate::value::Div;

declare_id!("7EJgijJbPFcDeqTweGQrdsQWdBp6SaQgJoAU6MUF5dQx");

#[program]
pub mod incept {
    use std::convert::TryInto;

    use crate::math::*;
    use crate::value::{Add, Compare, Mul, Sub, DEVNET_TOKEN_SCALE};

    use super::*;

    pub fn initialize_manager(
        ctx: Context<InitializeManager>,
        _manager_nonce: u8,
        _il_health_score_coefficient: u64,
        _il_health_score_cutoff: u64,
        _il_liquidation_reward_pct: u64,
    ) -> ProgramResult {
        require!(
            _il_health_score_coefficient > 0,
            InceptError::InvalidHealthScoreCoefficient
        );
        let mut token_data = ctx.accounts.token_data.load_init()?;

        // set manager data
        ctx.accounts.manager.token_data = *ctx.accounts.token_data.to_account_info().key;
        ctx.accounts.manager.usdi_mint = *ctx.accounts.usdi_mint.to_account_info().key;
        ctx.accounts.manager.liquidated_comet_usdi = *ctx
            .accounts
            .liquidated_comet_usdi_token_account
            .to_account_info()
            .key;
        ctx.accounts.manager.admin = *ctx.accounts.admin.to_account_info().key;

        // set token data
        token_data.manager = *ctx.accounts.manager.to_account_info().key;
        token_data.chainlink_program = *ctx.accounts.chainlink_program.to_account_info().key;
        token_data.il_health_score_coefficient =
            Value::new(_il_health_score_coefficient.into(), DEVNET_TOKEN_SCALE);
        token_data.il_health_score_cutoff =
            Value::new(_il_health_score_cutoff.into(), DEVNET_TOKEN_SCALE);
        token_data.il_liquidation_reward_pct =
            Value::new(_il_liquidation_reward_pct.into(), DEVNET_TOKEN_SCALE);

        Ok(())
    }

    pub fn update_il_health_score_coefficient(
        ctx: Context<UpdateILHealthScoreCoefficient>,
        _manager_nonce: u8,
        _il_health_score_coefficient: u64,
    ) -> ProgramResult {
        // ensure that a valid coefficient was entered
        require!(
            _il_health_score_coefficient > 0,
            InceptError::InvalidHealthScoreCoefficient
        );

        // update coefficient
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        token_data.il_health_score_coefficient =
            Value::new(_il_health_score_coefficient.into(), DEVNET_TOKEN_SCALE);

        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>, _user_nonce: u8) -> ProgramResult {
        // set user authority
        ctx.accounts.user_account.authority = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn initialize_single_pool_comets(
        ctx: Context<InitializeSinglePoolComets>,
        _user_nonce: u8,
    ) -> ProgramResult {
        let mut single_pool_comets = ctx.accounts.single_pool_comets.load_init()?;

        // set user data
        ctx.accounts.user_account.single_pool_comets =
            *ctx.accounts.single_pool_comets.to_account_info().key;

        // set user as owner
        single_pool_comets.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn initialize_mint_positions(
        ctx: Context<InitializeMintPositions>,
        _user_nonce: u8,
    ) -> ProgramResult {
        let mut mint_positions = ctx.accounts.mint_positions.load_init()?;

        // set user data
        ctx.accounts.user_account.mint_positions =
            *ctx.accounts.mint_positions.to_account_info().key;

        // set user as owner
        mint_positions.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn initialize_liquidity_positions(
        ctx: Context<InitializeLiquidityPositions>,
        _user_nonce: u8,
    ) -> ProgramResult {
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_init()?;

        // set user data
        ctx.accounts.user_account.liquidity_positions =
            *ctx.accounts.liquidity_positions.to_account_info().key;

        // set user as owner
        liquidity_positions.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn initialize_comet(ctx: Context<InitializeComet>, _user_nonce: u8) -> ProgramResult {
        let mut comet = ctx.accounts.comet.load_init()?;

        // set user data
        ctx.accounts.user_account.comet = *ctx.accounts.comet.to_account_info().key;

        // set user as owner
        comet.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn add_collateral(
        ctx: Context<AddCollateral>,
        _manager_nonce: u8,
        scale: u8,
        stable: u8,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut pool_index: u8 = u8::MAX;

        // check whether new collateral is stable (pegged to the US dollar)
        let is_stable: Result<bool, InceptError> = match stable {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(InceptError::InvalidBool),
        };

        // if the collateral is not stable, store its pool index, which shall store its oracle data
        if !(is_stable.unwrap()) {
            pool_index = TokenData::get_pool_tuple_from_oracle(
                token_data,
                [
                    &ctx.remaining_accounts[0].to_account_info().key,
                    &ctx.remaining_accounts[1].to_account_info().key,
                ],
            )
            .unwrap()
            .1
            .try_into()
            .unwrap();
        }

        // append collateral to list
        token_data.append_collateral(Collateral {
            pool_index: pool_index.try_into().unwrap(),
            mint: *ctx.accounts.collateral_mint.to_account_info().key,
            vault: *ctx.accounts.vault.to_account_info().key,
            vault_usdi_supply: Value::new(0, scale),
            vault_mint_supply: Value::new(0, scale),
            vault_comet_supply: Value::new(0, scale),
            stable: stable as u64,
        });

        Ok(())
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        _manager_nonce: u8,
        stable_collateral_ratio: u16,
        crypto_collateral_ratio: u16,
        liquidity_trading_fee: u16,
        health_score_coefficient: u64,
    ) -> ProgramResult {
        // ensure valid health score coefficient
        require!(
            health_score_coefficient > 0,
            InceptError::InvalidHealthScoreCoefficient
        );
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        // append pool to list
        token_data.append_pool(Pool {
            iasset_token_account: *ctx.accounts.iasset_token_account.to_account_info().key,
            usdi_token_account: *ctx.accounts.usdi_token_account.to_account_info().key,
            liquidity_token_mint: *ctx.accounts.liquidity_token_mint.to_account_info().key,
            liquidation_iasset_token_account: *ctx
                .accounts
                .liquidation_iasset_token_account
                .to_account_info()
                .key,
            comet_liquidity_token_account: *ctx
                .accounts
                .comet_liquidity_token_account
                .to_account_info()
                .key,
            iasset_amount: Value::new(0, DEVNET_TOKEN_SCALE),
            usdi_amount: Value::new(0, DEVNET_TOKEN_SCALE),
            liquidity_token_supply: Value::new(0, DEVNET_TOKEN_SCALE),
            treasury_trading_fee: Value::from_percent(0),
            liquidity_trading_fee: Value::from_percent(liquidity_trading_fee),
            asset_info: AssetInfo {
                ..Default::default()
            },
        });
        let index = token_data.num_pools - 1;
        token_data.pools[index as usize].asset_info.iasset_mint =
            *ctx.accounts.iasset_mint.to_account_info().key;
        token_data.pools[index as usize]
            .asset_info
            .price_feed_addresses = [
            *ctx.accounts.pyth_oracle.to_account_info().key,
            *ctx.accounts.chainlink_oracle.to_account_info().key,
        ];
        token_data.pools[index as usize]
            .asset_info
            .stable_collateral_ratio = Value::from_percent(stable_collateral_ratio);
        token_data.pools[index as usize]
            .asset_info
            .crypto_collateral_ratio = Value::from_percent(crypto_collateral_ratio);
        token_data.pools[index as usize]
            .asset_info
            .health_score_coefficient =
            Value::new(health_score_coefficient.into(), DEVNET_TOKEN_SCALE);

        Ok(())
    }

    pub fn update_pool_health_score_coefficient(
        ctx: Context<UpdatePoolHealthScore>,
        _manager_nonce: u8,
        pool_index: u8,
        health_score_coefficient: u64,
    ) -> ProgramResult {
        // ensure that a valid coefficient was entered
        require!(
            health_score_coefficient > 0,
            InceptError::InvalidHealthScoreCoefficient
        );
        // update coefficient
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        token_data.pools[pool_index as usize]
            .asset_info
            .health_score_coefficient =
            Value::new(health_score_coefficient.into(), DEVNET_TOKEN_SCALE);

        Ok(())
    }

    pub fn update_prices<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
        _manager_nonce: u8,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let chainlink_program = &ctx.accounts.chainlink_program;
        let n_accounts = ctx.remaining_accounts.iter().len();
        if n_accounts == 0 {
            return Err(InceptError::NoRemainingAccountsSupplied.into());
        }
        // loop through each oracle entered into the instruction
        for i in 0..n_accounts {
            if i % 2 != 0 {
                continue;
            }
            let pyth_oracle = &ctx.remaining_accounts[i];
            let chainlink_oracle = &ctx.remaining_accounts[i + 1];
            // generate data from pyth oracle
            let price_feed = Price::load(pyth_oracle)?;
            let expo_u8: u8 = price_feed.expo.abs().try_into().unwrap();
            let (_, pool_index) = TokenData::get_pool_tuple_from_oracle(
                token_data,
                [
                    pyth_oracle.to_account_info().key,
                    chainlink_oracle.to_account_info().key,
                ],
            )?;
            let pyth_price = Value::new(price_feed.agg.price.try_into().unwrap(), expo_u8);
            let confidence = Value::new(price_feed.agg.conf.try_into().unwrap(), expo_u8);
            // ensure prices have proper confidence
            check_price_confidence(pyth_price, confidence)?;

            // Generate data from Chainlink oracle
            let round = chainlink::latest_round_data(
                chainlink_program.to_account_info(),
                chainlink_oracle.to_account_info(),
            )?;

            let decimals = chainlink::decimals(
                chainlink_program.to_account_info(),
                chainlink_oracle.to_account_info(),
            )?;

            let chainlink_price =
                Value::new(round.answer.try_into().unwrap(), decimals).scale_to(DEVNET_TOKEN_SCALE);

            // take an average to use as the oracle price.
            let average_price = chainlink_price
                .add(pyth_price.scale_to(DEVNET_TOKEN_SCALE))
                .unwrap()
                .div(Value::new(2, 0).scale_to(DEVNET_TOKEN_SCALE));

            // update price data
            token_data.pools[pool_index].asset_info.price = average_price;
            token_data.pools[pool_index].asset_info.twap =
                Value::new(price_feed.twap.try_into().unwrap(), expo_u8);
            token_data.pools[pool_index].asset_info.confidence =
                Value::new(price_feed.agg.conf.try_into().unwrap(), expo_u8);
            token_data.pools[pool_index].asset_info.status = price_feed.agg.status as u64;
            token_data.pools[pool_index].asset_info.last_update = Clock::get()?.slot;
        }

        Ok(())
    }

    pub fn mint_usdi(ctx: Context<MintUSDI>, manager_nonce: u8, amount: u64) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let (collateral, collateral_index) =
            TokenData::get_collateral_tuple(token_data, *ctx.accounts.vault.to_account_info().key)
                .unwrap();
        let collateral_scale = collateral.vault_mint_supply.scale;

        let usdi_value = Value::new(amount.into(), DEVNET_TOKEN_SCALE);
        let collateral_value = Value::new(
            ctx.accounts.user_collateral_token_account.amount.into(),
            collateral_scale.try_into().unwrap(),
        );

        // check to see if the collateral used to mint usdi is stable
        let is_stable: Result<bool, InceptError> = match collateral.stable {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(InceptError::InvalidBool),
        };

        // if collateral is not stable, we throw an error
        if !(is_stable.unwrap()) {
            return Err(InceptError::InvalidCollateralType.into());
        }

        // check if their is sufficient collateral to mint
        if usdi_value
            .scale_to(collateral_scale.try_into().unwrap())
            .gt(collateral_value)
            .unwrap()
        {
            return Err(InceptError::InsufficientCollateral.into());
        }

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index].vault_usdi_supply =
            collateral.vault_usdi_supply.add(collateral_value).unwrap();

        // transfer user collateral to vault
        let cpi_ctx_transfer: CpiContext<Transfer> = CpiContext::from(&*ctx.accounts);
        token::transfer(
            cpi_ctx_transfer,
            usdi_value
                .scale_to(collateral_scale.try_into().unwrap())
                .to_u64(),
        )?;

        // mint usdi to user
        let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx_mint, amount)?;

        Ok(())
    }

    pub fn initialize_mint_position(
        ctx: Context<InitializeMintPosition>,
        manager_nonce: u8,
        iasset_amount: u64,
        collateral_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let (collateral, collateral_index) = TokenData::get_collateral_tuple(
            &*token_data,
            *ctx.accounts.vault.to_account_info().key,
        )
        .unwrap();

        let (pool, pool_index) = TokenData::get_pool_tuple_from_iasset_mint(
            &*token_data,
            *ctx.accounts.iasset_mint.to_account_info().key,
        )
        .unwrap();

        let collateral_amount_value = Value::new(
            collateral_amount.into(),
            collateral.vault_mint_supply.scale.try_into().unwrap(),
        );
        let iasset_amount_value = Value::new(iasset_amount.into(), DEVNET_TOKEN_SCALE);

        // check to see if collateral is stable
        let is_stable: Result<bool, InceptError> = match collateral.stable {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err(InceptError::InvalidBool),
        };

        // if collateral is not stable, throw an error
        if !(is_stable.unwrap()) {
            return Err(InceptError::InvalidCollateralType.into());
        }
        let collateral_ratio = pool.asset_info.stable_collateral_ratio;

        // ensure position sufficiently over collateralized and oracle prices are up to date
        let slot = Clock::get()?.slot;
        check_mint_collateral_sufficient(
            pool.asset_info,
            iasset_amount_value,
            collateral_ratio,
            collateral_amount_value,
            slot,
        )?;

        // lock user collateral in vault
        let cpi_ctx_transfer: CpiContext<Transfer> = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx_transfer, collateral_amount)?;

        // mint iasset to user
        let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx_mint, iasset_amount)?;

        // set mint position data
        let mut mint_positions = ctx.accounts.mint_positions.load_mut()?;
        let num_positions = mint_positions.num_positions;
        mint_positions.mint_positions[num_positions as usize] = MintPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: collateral_amount_value,
            collateral_index: collateral_index.try_into().unwrap(),
            pool_index: pool_index.try_into().unwrap(),
            borrowed_iasset: iasset_amount_value,
        };

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index].vault_mint_supply = collateral
            .vault_mint_supply
            .add(collateral_amount_value)
            .unwrap();

        // increment number of mint positions
        mint_positions.num_positions += 1;

        Ok(())
    }

    pub fn add_collateral_to_mint(
        ctx: Context<AddCollateralToMint>,
        _manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

        let collateral = token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize];
        let mint_position = mint_positions.mint_positions[mint_index as usize];

        let amount_value = Value::new(
            amount.into(),
            collateral.vault_mint_supply.scale.try_into().unwrap(),
        );

        // add collateral amount to vault supply
        token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
            .vault_mint_supply = collateral.vault_mint_supply.add(amount_value).unwrap();

        // add collateral amount to mint data
        mint_positions.mint_positions[mint_index as usize].collateral_amount =
            mint_position.collateral_amount.add(amount_value).unwrap();

        // send collateral to vault
        let cpi_ctx = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn withdraw_collateral_from_mint(
        ctx: Context<WithdrawCollateralFromMint>,
        manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

        let pool_index = mint_positions.mint_positions[mint_index as usize].pool_index;
        let pool = token_data.pools[pool_index as usize];
        let collateral_ratio = pool.asset_info.stable_collateral_ratio;
        let collateral = token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize];
        let mint_position = mint_positions.mint_positions[mint_index as usize];

        let amount_value = Value::new(
            amount.into(),
            collateral.vault_mint_supply.scale.try_into().unwrap(),
        );

        // subtract collateral amount from vault supply
        token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
            .vault_mint_supply = collateral.vault_mint_supply.sub(amount_value).unwrap();

        // subtract collateral amount from mint data
        mint_positions.mint_positions[mint_index as usize].collateral_amount =
            mint_position.collateral_amount.sub(amount_value).unwrap();

        let slot = Clock::get()?.slot;

        // ensure position sufficiently over collateralized and oracle prices are up to date
        check_mint_collateral_sufficient(
            pool.asset_info,
            mint_position.borrowed_iasset,
            collateral_ratio,
            mint_positions.mint_positions[mint_index as usize].collateral_amount,
            slot,
        )
        .unwrap();

        // send collateral back to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::transfer(cpi_ctx, amount)?;

        // check to see if mint is empty, if so remove
        if mint_positions.mint_positions[mint_index as usize]
            .collateral_amount
            .to_u64()
            == 0
        {
            mint_positions.remove(mint_index as usize);
        }

        Ok(())
    }

    pub fn pay_back_mint(
        ctx: Context<PayBackiAssetToMint>,
        _manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let amount_value = Value::new(amount.into(), DEVNET_TOKEN_SCALE);

        let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;
        let mint_position = mint_positions.mint_positions[mint_index as usize];

        // burn user iasset to pay back mint position
        let cpi_ctx_burn: CpiContext<Burn> = CpiContext::from(&*ctx.accounts);
        token::burn(cpi_ctx_burn, amount)?;

        // update total amount of borrowed iasset
        mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
            mint_position.borrowed_iasset.sub(amount_value).unwrap();

        Ok(())
    }

    pub fn add_iasset_to_mint(
        ctx: Context<AddiAssetToMint>,
        manager_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let token_data = ctx.accounts.token_data.load_mut()?;
        let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

        let amount_value = Value::new(amount.into(), DEVNET_TOKEN_SCALE);

        let pool_index = mint_positions.mint_positions[mint_index as usize].pool_index;
        let pool = token_data.pools[pool_index as usize];
        let mint_position = mint_positions.mint_positions[mint_index as usize];
        let collateral_ratio = pool.asset_info.stable_collateral_ratio;

        // update total amount of borrowed iasset
        mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
            mint_position.borrowed_iasset.add(amount_value).unwrap();

        let slot = Clock::get()?.slot;

        // ensure position sufficiently over collateralized and oracle prices are up to date
        check_mint_collateral_sufficient(
            pool.asset_info,
            mint_positions.mint_positions[mint_index as usize].borrowed_iasset,
            collateral_ratio,
            mint_position.collateral_amount,
            slot,
        )
        .unwrap();

        // mint iasset to the user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn initialize_liquidity_position(
        ctx: Context<InitializeLiquidityPosition>,
        manager_nonce: u8,
        pool_index: u8,
        iasset_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let iasset_liquidity_value = Value::new(iasset_amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate amount of usdi required as well as amount of liquidity tokens to be received
        let (mut usdi_liquidity_value, mut liquidity_token_value) =
            calculate_liquidity_provider_values_from_iasset(
                iasset_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        // check to see if the pool is currently empty
        if iasset_amm_value.val == 0 && usdi_amm_value.val == 0 {
            usdi_liquidity_value =
                usdi_liquidity_value.mul(token_data.pools[pool_index as usize].asset_info.price);
            liquidity_token_value =
                liquidity_token_value.mul(token_data.pools[pool_index as usize].asset_info.price);
        }

        // transfer iasset from user to amm
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .user_iasset_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let send_iasset_to_amm_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::transfer(send_iasset_to_amm_context, iasset_amount)?;

        // transfer usdi from user to amm
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .user_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let send_usdi_to_amm_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::transfer(send_usdi_to_amm_context, usdi_liquidity_value.to_u64())?;

        // mint liquidity tokens to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx, liquidity_token_value.to_u64())?;

        // set liquidity position data
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
        let num_positions = liquidity_positions.num_positions;
        liquidity_positions.liquidity_positions[num_positions as usize] = LiquidityPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            liquidity_token_value: liquidity_token_value,
            pool_index: pool_index.try_into().unwrap(),
        };
        liquidity_positions.num_positions += 1;

        // update pool data
        token_data.pools[pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn provide_liquidity(
        ctx: Context<ProvideLiquidity>,
        manager_nonce: u8,
        liquidity_position_index: u8,
        iasset_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let iasset_liquidity_value = Value::new(iasset_amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate amount of usdi required as well as amount of liquidity tokens to be received
        let (usdi_liquidity_value, liquidity_token_value) =
            calculate_liquidity_provider_values_from_iasset(
                iasset_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        // transfer iasset from user to amm
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .user_iasset_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let send_iasset_to_amm_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::transfer(send_iasset_to_amm_context, iasset_amount)?;

        // transfer usdi from user to amm
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .user_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let send_usdi_to_amm_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::transfer(send_usdi_to_amm_context, usdi_liquidity_value.to_u64())?;

        // mint liquidity tokens to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx, liquidity_token_value.to_u64())?;

        // update liquidity position data
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
        let liquidity_position =
            liquidity_positions.liquidity_positions[liquidity_position_index as usize];
        liquidity_positions.liquidity_positions[liquidity_position_index as usize]
            .liquidity_token_value = liquidity_position
            .liquidity_token_value
            .add(liquidity_token_value)
            .unwrap();

        // update pool data
        token_data.pools[liquidity_position.pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].liquidity_token_supply =
            Value::new(
                ctx.accounts.liquidity_token_mint.supply.into(),
                DEVNET_TOKEN_SCALE,
            );

        Ok(())
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        manager_nonce: u8,
        liquidity_position_index: u8,
        liquidity_token_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let liquidity_token_value = Value::new(liquidity_token_amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate the amount of iasset and usdi that the user can withdraw
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

        // burn user liquidity tokens
        let cpi_ctx = CpiContext::from(&*ctx.accounts);
        token::burn(cpi_ctx, liquidity_token_amount)?;

        // transfer usdi to user from amm
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
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_usdi_to_user_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::transfer(send_usdi_to_user_context, usdi_value.to_u64())?;

        // transfer iasset to user from amm
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
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_iasset_to_user_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::transfer(send_iasset_to_user_context, iasset_value.to_u64())?;

        // update liquidity position data
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
        let liquidity_position =
            liquidity_positions.liquidity_positions[liquidity_position_index as usize];
        liquidity_positions.liquidity_positions[liquidity_position_index as usize]
            .liquidity_token_value = liquidity_position
            .liquidity_token_value
            .sub(liquidity_token_value)
            .unwrap();

        if liquidity_positions.liquidity_positions[liquidity_position_index as usize]
            .liquidity_token_value
            .to_u64()
            == 0
        {
            // remove liquidity position from user list
            liquidity_positions.remove(liquidity_position_index as usize);
        }

        // update pool data
        token_data.pools[liquidity_position.pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].liquidity_token_supply =
            Value::new(
                ctx.accounts.liquidity_token_mint.supply.into(),
                DEVNET_TOKEN_SCALE,
            );

        Ok(())
    }

    pub fn buy_synth(
        ctx: Context<BuySynth>,
        manager_nonce: u8,
        pool_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let pool = token_data.pools[pool_index as usize];

        let iasset_amount_value = Value::new(amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate how much usdi must be spent
        let usdi_amount_value = calculate_price_from_iasset(
            iasset_amount_value,
            iasset_amm_value,
            usdi_amm_value,
            true,
        )?;

        // ensure that the user has sufficient usdi
        if ctx.accounts.user_usdi_token_account.amount < usdi_amount_value.to_u64() {
            return Err(InceptError::InvalidTokenAmount.into());
        }

        // transfer usdi from user to amm
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .user_usdi_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let send_usdi_to_amm_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::transfer(send_usdi_to_amm_context, usdi_amount_value.to_u64())?;

        // transfer iasset to user from amm
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
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_iasset_to_user_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        let iasset_amount_value = iasset_amount_value
            .sub(iasset_amount_value.mul(pool.liquidity_trading_fee))?
            .to_u64();

        token::transfer(
            send_iasset_to_user_context,
            iasset_amount_value
        )?;

        // update pool data
        let usdi_pool_total = ctx.accounts.amm_usdi_token_account.amount + usdi_amount_value.to_u64();
        let iasset_pool_total = ctx.accounts.amm_iasset_token_account.amount - iasset_amount_value;

        token_data.pools[pool_index as usize].iasset_amount = Value::new(
            iasset_pool_total.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].usdi_amount = Value::new(
            usdi_pool_total.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn sell_synth(
        ctx: Context<SellSynth>,
        manager_nonce: u8,
        pool_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let pool = token_data.pools[pool_index as usize];

        let iasset_amount_value = Value::new(amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate how much usdi will be recieved
        let usdi_amount_value = calculate_price_from_iasset(
            iasset_amount_value,
            iasset_amm_value,
            usdi_amm_value,
            false,
        )?;

        // transfer iasset from user to amm
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .user_iasset_token_account
                .to_account_info()
                .clone(),
            to: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        let send_iasset_to_amm_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::transfer(send_iasset_to_amm_context, amount)?;

        // transfer usdi to user from amm
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
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_usdi_to_user_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        let usdi_amount_value = usdi_amount_value
            .sub(usdi_amount_value.mul(pool.liquidity_trading_fee))?
            .to_u64();

        token::transfer(
            send_usdi_to_user_context,
            usdi_amount_value
        )?;

        // update pool data
        let usdi_pool_total = ctx.accounts.amm_usdi_token_account.amount - usdi_amount_value;
        let iasset_pool_total = ctx.accounts.amm_iasset_token_account.amount + iasset_amount_value.to_u64();

        token_data.pools[pool_index as usize].iasset_amount = Value::new(
            iasset_pool_total.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].usdi_amount = Value::new(
            usdi_pool_total.into(),
            DEVNET_TOKEN_SCALE,
        );
        Ok(())
    }

    pub fn initialize_single_pool_comet(
        ctx: Context<InitializeSinglePoolComet>,
        _manager_nonce: u8,
        pool_index: u8,
    ) -> ProgramResult {
        let token_data = &mut &mut ctx.accounts.token_data.load_mut()?;

        let (collateral, collateral_index) = token_data
            .get_collateral_tuple(*ctx.accounts.vault.to_account_info().key)
            .unwrap();

        // set comet data
        let mut single_pool_comets = ctx.accounts.single_pool_comets.load_mut()?;
        let num_comets = single_pool_comets.num_comets;

        // add comet key to user's single pool comets
        single_pool_comets.comets[num_comets as usize] =
            *ctx.accounts.single_pool_comet.to_account_info().key;
        single_pool_comets.num_comets += 1;

        // set single pool comet data
        let mut single_pool_comet = ctx.accounts.single_pool_comet.load_init()?;
        single_pool_comet.is_single_pool = 1;
        single_pool_comet.owner = *ctx.accounts.user.to_account_info().key;
        single_pool_comet.add_collateral(CometCollateral {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: Value::new(
                0,
                collateral.vault_comet_supply.scale.try_into().unwrap(),
            ),
            collateral_index: collateral_index as u64,
        });
        single_pool_comet.add_position(CometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            pool_index: pool_index as u64,
            borrowed_usdi: Value::new(0, DEVNET_TOKEN_SCALE),
            borrowed_iasset: Value::new(0, DEVNET_TOKEN_SCALE),
            liquidity_token_value: Value::new(0, DEVNET_TOKEN_SCALE),
            comet_liquidation: CometLiquidation {
                ..Default::default()
            },
        });

        Ok(())
    }

    pub fn close_single_pool_comet(
        ctx: Context<CloseSinglePoolComet>,
        manager_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        {
            let mut single_pool_comets = ctx.accounts.single_pool_comets.load_mut()?;
            let single_pool_comet = ctx.accounts.single_pool_comet.load()?;
            let single_pool_comet_position = single_pool_comet.positions[0];

            let iasset_amm_value = Value::new(
                ctx.accounts.amm_iasset_token_account.amount.into(),
                DEVNET_TOKEN_SCALE,
            );
            let usdi_amm_value = Value::new(
                ctx.accounts.amm_usdi_token_account.amount.into(),
                DEVNET_TOKEN_SCALE,
            );

            let liquidity_token_supply = Value::new(
                ctx.accounts.liquidity_token_mint.supply.into(),
                DEVNET_TOKEN_SCALE,
            );

            // throw error if the comet is already liquidated
            if single_pool_comet_position.comet_liquidation.status == 2u64 { //Fully liquidated
                return Err(InceptError::CometAlreadyLiquidated.into());
            }

            // calculate initial comet pool price
            let initial_comet_price = calculate_amm_price(
                single_pool_comet_position.borrowed_iasset,
                single_pool_comet_position.borrowed_usdi,
            );
            // calculate current pool price
            let current_market_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

            // calculate usdi and iasset comet can claim right now
            let (iasset_value, usdi_value) =
                calculate_liquidity_provider_values_from_liquidity_tokens(
                    single_pool_comet_position.liquidity_token_value,
                    iasset_amm_value,
                    usdi_amm_value,
                    liquidity_token_supply,
                )?;

            // check if the price has moved significantly
            if (iasset_value
                .lte(single_pool_comet_position.borrowed_iasset)
                .unwrap()
                && usdi_value
                    .lte(single_pool_comet_position.borrowed_usdi)
                    .unwrap())
                || (iasset_value
                    .gte(single_pool_comet_position.borrowed_iasset)
                    .unwrap()
                    && usdi_value
                        .gte(single_pool_comet_position.borrowed_usdi)
                        .unwrap())
            {
                // price has NOT moved significantly
                // burn liquidity tokens from comet to recover liquidity
                let cpi_accounts = Burn {
                    mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .comet_liquidity_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_liquidity_tokens_from_comet_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_liquidity_tokens_from_comet_context,
                    single_pool_comet_position.liquidity_token_value.to_u64(),
                )?;

                // burn iasset from amm
                let cpi_accounts = Burn {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_iasset_from_amm_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_iasset_from_amm_context,
                    single_pool_comet_position.borrowed_iasset.to_u64(),
                )?;

                // burn usdi from amm
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_usdi_from_amm_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_usdi_from_amm_context,
                    single_pool_comet_position.borrowed_usdi.to_u64(),
                )?;
            }
            // check if price has increased since comet was initialized
            else if initial_comet_price.lt(current_market_price).unwrap() {
                //calculate impermanent loss
                let iasset_impermanent_loss = single_pool_comet_position
                    .borrowed_iasset
                    .sub(iasset_value)
                    .unwrap();

                // burn iasset from user to pay back impermanent loss
                let cpi_accounts = Burn {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                };
                let burn_iasset_from_user_context = CpiContext::new(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                );

                token::burn(
                    burn_iasset_from_user_context,
                    iasset_impermanent_loss.to_u64(),
                )?;

                // burn liquidity tokens from comet to recover liquidity
                let cpi_accounts = Burn {
                    mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .comet_liquidity_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_liquidity_tokens_from_comet_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_liquidity_tokens_from_comet_context,
                    single_pool_comet_position.liquidity_token_value.to_u64(),
                )?;

                // burn iasset from amm
                let cpi_accounts = Burn {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_iasset_from_amm_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(burn_iasset_from_amm_context, iasset_value.to_u64())?;

                // burn usdi from amm
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_usdi_from_amm_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_usdi_from_amm_context,
                    single_pool_comet_position.borrowed_usdi.to_u64(),
                )?;

                // transfer surplus usdi from the amm to the user
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
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let send_usdi_to_user_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::transfer(
                    send_usdi_to_user_context,
                    usdi_value
                        .sub(single_pool_comet_position.borrowed_usdi)
                        .unwrap()
                        .to_u64(),
                )?;
            } else {
                // price has decreased since comet was initialized
                // calculate impermanent loss
                let usdi_impermanent_loss = single_pool_comet_position
                    .borrowed_usdi
                    .sub(usdi_value)
                    .unwrap();

                // burn usdi from the user to pay back impermanent loss
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .user_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.user.to_account_info().clone(),
                };
                let burn_usdi_from_user_context = CpiContext::new(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                );

                token::burn(burn_usdi_from_user_context, usdi_impermanent_loss.to_u64())?;

                // burn liquidity tokens from comet to recover liquidity
                let cpi_accounts = Burn {
                    mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .comet_liquidity_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_liquidity_tokens_from_comet_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_liquidity_tokens_from_comet_context,
                    single_pool_comet_position.liquidity_token_value.to_u64(),
                )?;

                // burn usdi from amm
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_usdi_from_amm_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(burn_usdi_from_amm_context, usdi_value.to_u64())?;

                // burn iasset from amm
                let cpi_accounts = Burn {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_iasset_from_amm_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::burn(
                    burn_iasset_from_amm_context,
                    single_pool_comet_position.borrowed_iasset.to_u64(),
                )?;

                // transfer surplus iasset from the amm to the user
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
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let send_iasset_to_user_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );

                token::transfer(
                    send_iasset_to_user_context,
                    iasset_value
                        .sub(single_pool_comet_position.borrowed_iasset)
                        .unwrap()
                        .to_u64(),
                )?;
            }

            let comet_collateral = single_pool_comet.collaterals[0];
            let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

            // subtract collateral amount from vault supply
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                collateral
                    .vault_comet_supply
                    .sub(comet_collateral.collateral_amount)
                    .unwrap();

            // send collateral from vault to user
            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_collateral_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_collateral_to_user_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_collateral_to_user_context,
                comet_collateral.collateral_amount.to_u64(),
            )?;

            // remove the single pool comet
            single_pool_comets.remove(comet_index as usize);

            // update pool data
            token_data.pools[single_pool_comet_position.pool_index as usize].iasset_amount =
                Value::new(
                    ctx.accounts.amm_iasset_token_account.amount.into(),
                    DEVNET_TOKEN_SCALE,
                );
            token_data.pools[single_pool_comet_position.pool_index as usize].usdi_amount =
                Value::new(
                    ctx.accounts.amm_usdi_token_account.amount.into(),
                    DEVNET_TOKEN_SCALE,
                );
            token_data.pools[single_pool_comet_position.pool_index as usize]
                .liquidity_token_supply = Value::new(
                ctx.accounts.liquidity_token_mint.supply.into(),
                DEVNET_TOKEN_SCALE,
            );
        }
        // close single pool comet account
        ctx.accounts
            .single_pool_comet
            .close(ctx.accounts.user.to_account_info())?;

        Ok(())
    }

    pub fn initialize_comet_manager(
        ctx: Context<InitializeCometManager>,
        _manager_nonce: u8,
        _user_nonce: u8,
    ) -> ProgramResult {
        let mut comet_manager = ctx.accounts.comet_manager.load_init()?;

        // set user data
        ctx.accounts.user_account.is_manager = 1;
        ctx.accounts.user_account.comet_manager = *ctx.accounts.comet_manager.to_account_info().key;

        // set comet manager data
        comet_manager.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        _manager_nonce: u8,
        collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;

        let collateral = token_data.collaterals[collateral_index as usize];

        let added_collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale.try_into().unwrap(),
        );

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index as usize].vault_comet_supply = collateral
            .vault_comet_supply
            .add(added_collateral_value)
            .unwrap();

        // add collateral amount to total comet collateral amount
        comet.total_collateral_amount = comet
            .total_collateral_amount
            .scale_to(DEVNET_TOKEN_SCALE)
            .add(added_collateral_value.scale_to(DEVNET_TOKEN_SCALE))
            .unwrap();

        // set next collateral to default data
        let num_collaterals = comet.num_collaterals;
        // comet.collaterals[num_collaterals as usize] = CometCollateral::default();
        // msg!("hello");
        msg!(
            &comet.collaterals[num_collaterals as usize]
                .collateral_index
                .to_string()[..]
        );

        // find the comet collateral index
        let comet_collateral_index = comet.get_collateral_index(collateral_index);
        msg!(&comet_collateral_index.to_string());

        // check to see if a new collateral must be added to the position
        if comet_collateral_index == usize::MAX {
            if comet.is_single_pool == 1 {
                return Err(InceptError::AttemptedToAddNewCollateralToSingleComet.into());
            }
            comet.add_collateral(CometCollateral {
                authority: *ctx.accounts.user.to_account_info().key,
                collateral_amount: added_collateral_value,
                collateral_index: collateral_index.into(),
            });
        } else {
            comet.collaterals[comet_collateral_index].collateral_amount = comet.collaterals
                [comet_collateral_index]
                .collateral_amount
                .add(added_collateral_value)
                .unwrap();
        }

        // send collateral from user to vault
        let cpi_ctx = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx, collateral_amount)?;

        Ok(())
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        manager_nonce: u8,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_collateral = comet.collaterals[comet_collateral_index as usize];
        let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

        let subtracted_collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale.try_into().unwrap(),
        );

        // subtract collateral amount from vault supply
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            collateral
                .vault_comet_supply
                .sub(subtracted_collateral_value)
                .unwrap();

        // subtract collateral amount from total collateral amount
        comet.total_collateral_amount = comet
            .total_collateral_amount
            .sub(subtracted_collateral_value.scale_to(DEVNET_TOKEN_SCALE))
            .unwrap();

        // ensure the position holds sufficient collateral
        if comet_collateral
            .collateral_amount
            .lt(subtracted_collateral_value)
            .unwrap()
        {
            return Err(InceptError::InsufficientCollateral.into());
        }

        // update the collateral amount
        comet.collaterals[comet_collateral_index as usize].collateral_amount = comet_collateral
            .collateral_amount
            .sub(subtracted_collateral_value)
            .unwrap();

        // remove collateral if empty
        if comet.collaterals[comet_collateral_index as usize]
            .collateral_amount
            .val
            == 0
        {
            comet.remove_collateral(comet_collateral_index as usize)
        }

        // send collateral from vault to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::transfer(cpi_ctx, collateral_amount)?;

        // Require a healthy score after transactions
        let health_score = calculate_health_score(&comet, token_data)?;

        require!(
            matches!(health_score, math::HealthScore::Healthy { .. }),
            error::InceptError::HealthScoreTooLow
        );

        Ok(())
    }

    pub fn add_liquidity_to_comet(
        ctx: Context<AddLiquidityToComet>,
        manager_nonce: u8,
        pool_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;

        let usdi_liquidity_value = Value::new(usdi_amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate iasset liquidity value as well as liquidity token value for comet
        let (iasset_liquidity_value, liquidity_token_value) =
            calculate_liquidity_provider_values_from_usdi(
                usdi_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        // find the index of the position within the comet position
        let comet_position_index = comet.get_pool_index(pool_index);

        // check to see if a new position must be added to the position
        if comet_position_index == usize::MAX {
            if comet.is_single_pool == 1 {
                return Err(InceptError::AttemptedToAddNewPoolToSingleComet.into());
            }
            comet.add_position(CometPosition {
                authority: *ctx.accounts.user.to_account_info().key,
                pool_index: pool_index as u64,
                borrowed_usdi: usdi_liquidity_value,
                borrowed_iasset: iasset_liquidity_value,
                liquidity_token_value: liquidity_token_value,
                comet_liquidation: CometLiquidation {
                    ..Default::default()
                },
            });
        } else {
            // update comet position data
            let position = comet.positions[comet_position_index];
            comet.positions[comet_position_index].borrowed_usdi =
                position.borrowed_usdi.add(usdi_liquidity_value).unwrap();
            comet.positions[comet_position_index].borrowed_iasset = position
                .borrowed_iasset
                .add(iasset_liquidity_value)
                .unwrap();
            comet.positions[comet_position_index].liquidity_token_value = position
                .liquidity_token_value
                .add(liquidity_token_value)
                .unwrap();
        }

        // mint liquidity into amm
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
        token::mint_to(mint_usdi_context, usdi_amount)?;
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
        token::mint_to(mint_iasset_context, iasset_liquidity_value.to_u64())?;

        // mint liquidity tokens to comet
        let cpi_accounts = MintTo {
            mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .comet_liquidity_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::mint_to(
            mint_liquidity_tokens_to_comet_context,
            liquidity_token_value.to_u64(),
        )?;

        // update pool data
        token_data.pools[pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // Require a healthy score after transactions
        let health_score = calculate_health_score(&comet, token_data)?;

        require!(
            matches!(health_score, math::HealthScore::Healthy { .. }),
            error::InceptError::HealthScoreTooLow
        );

        Ok(())
    }

    pub fn withdraw_liquidity_from_comet(
        ctx: Context<WithdrawLiquidityFromComet>,
        manager_nonce: u8,
        comet_position_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_position = comet.positions[comet_position_index as usize];

        let usdi_liquidity_value = Value::new(usdi_amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate iasset liquidity value as well as liquidity token value for comet
        let (iasset_liquidity_value, liquidity_token_value) =
            calculate_liquidity_provider_values_from_usdi(
                usdi_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        // update comet position data
        comet.positions[comet_position_index as usize].borrowed_usdi = comet_position
            .borrowed_usdi
            .sub(usdi_liquidity_value)
            .unwrap();
        comet.positions[comet_position_index as usize].borrowed_iasset = comet_position
            .borrowed_iasset
            .sub(iasset_liquidity_value)
            .unwrap();
        comet.positions[comet_position_index as usize].liquidity_token_value = comet_position
            .liquidity_token_value
            .sub(liquidity_token_value)
            .unwrap();

        // calculate initial comet pool price
        let initial_comet_price =
            calculate_amm_price(comet_position.borrowed_iasset, comet_position.borrowed_usdi);
        // calculate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // check if price has increased since comet was initialized
        if initial_comet_price.lt(current_price).unwrap() {
            let iasset_burn_value = initial_comet_price.mul(iasset_liquidity_value);
            // burn liquidity from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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
            token::burn(burn_usdi_context, usdi_amount)?;
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, iasset_burn_value.to_u64())?;

            // transfer surplus iasset to liquidity provider
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
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let transfer_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::transfer(
                transfer_iasset_context,
                iasset_liquidity_value
                    .sub(iasset_burn_value)
                    .unwrap()
                    .to_u64(),
            )?;
        } else if initial_comet_price.gt(current_price).unwrap() {
            let usdi_burn_value = usdi_liquidity_value.div(initial_comet_price);
            // burn liquidity from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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
            token::burn(burn_usdi_context, usdi_burn_value.to_u64())?;
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, iasset_liquidity_value.to_u64())?;

            // transfer surplus iasset to liquidity provider
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
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let transfer_usdi_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::transfer(
                transfer_usdi_context,
                usdi_liquidity_value.sub(usdi_burn_value).unwrap().to_u64(),
            )?;
        } else {
            // burn liquidity from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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
            token::burn(burn_usdi_context, usdi_amount)?;
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, iasset_liquidity_value.to_u64())?;
        }
        // burn liquidity tokens from comet
        let cpi_accounts = Burn {
            mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .comet_liquidity_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::burn(
            burn_liquidity_tokens_to_comet_context,
            liquidity_token_value.to_u64(),
        )?;

        // update pool data
        token_data.pools[comet_position.pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn withdraw_liquidity_from_comet_surplus_to_collateral(
        ctx: Context<WithdrawLiquidityFromCometSurplusToCollateral>,
        manager_nonce: u8,
        comet_position_index: u8,
        collateral_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_position = comet.positions[comet_position_index as usize];
        let collateral = token_data.collaterals[collateral_index as usize];

        let usdi_liquidity_value = Value::new(usdi_amount.into(), DEVNET_TOKEN_SCALE);
        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate iasset liquidity value as well as liquidity token value for comet
        let (iasset_liquidity_value, liquidity_token_value) =
            calculate_liquidity_provider_values_from_usdi(
                usdi_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        // update comet position data
        comet.positions[comet_position_index as usize].borrowed_usdi = comet_position
            .borrowed_usdi
            .sub(usdi_liquidity_value)
            .unwrap();
        comet.positions[comet_position_index as usize].borrowed_iasset = comet_position
            .borrowed_iasset
            .sub(iasset_liquidity_value)
            .unwrap();
        comet.positions[comet_position_index as usize].liquidity_token_value = comet_position
            .liquidity_token_value
            .sub(liquidity_token_value)
            .unwrap();

        // calculate initial comet pool price
        let initial_comet_price =
            calculate_amm_price(comet_position.borrowed_iasset, comet_position.borrowed_usdi);
        // calculate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // check if price has increased since comet was initialized
        if initial_comet_price.lt(current_price).unwrap() {
            let iasset_burn_value = usdi_liquidity_value.div(initial_comet_price);

            // calculate how much usdi must be spent
            let usdi_trade_value = calculate_price_from_iasset(
                iasset_liquidity_value.sub(iasset_burn_value).unwrap(),
                iasset_amm_value,
                usdi_amm_value,
                true,
            )?;

            // burn liquidity from the amm and move surplus to collateral
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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
            token::burn(
                burn_usdi_context,
                usdi_liquidity_value.add(usdi_trade_value).unwrap().to_u64(),
            )?;
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, iasset_burn_value.to_u64())?;

            // check if sufficient collateral exists within the vault
            if collateral.vault_usdi_supply.lt(usdi_trade_value).unwrap() {
                return Err(InceptError::InsufficientUSDiCollateral.into());
            }
            // subtract amount from vault usdi supply and move to comet supply
            token_data.collaterals[collateral_index as usize].vault_usdi_supply = collateral
                .vault_usdi_supply
                .sub(
                    usdi_trade_value
                        .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                )
                .unwrap();
            token_data.collaterals[collateral_index as usize].vault_comet_supply = collateral
                .vault_comet_supply
                .add(
                    usdi_trade_value
                        .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                )
                .unwrap();

            // add collateral amount to total collateral amount
            comet.total_collateral_amount =
                comet.total_collateral_amount.add(usdi_trade_value).unwrap();

            // find the index of the collateral within the comet holder's position
            let comet_collateral_index = comet.get_collateral_index(collateral_index);

            // check to see if a new collateral must be added to the position
            if comet_collateral_index == usize::MAX {
                comet.add_collateral(CometCollateral {
                    authority: *ctx.accounts.user.to_account_info().key,
                    collateral_amount: usdi_trade_value
                        .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                    collateral_index: collateral_index.into(),
                });
            } else {
                comet.collaterals[comet_collateral_index].collateral_amount = comet.collaterals
                    [comet_collateral_index]
                    .collateral_amount
                    .add(
                        usdi_trade_value
                            .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                    )
                    .unwrap();
            }
        } else if initial_comet_price.gt(current_price).unwrap() {
            let usdi_burn_value = iasset_liquidity_value.mul(initial_comet_price);
            // burn liquidity from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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
            token::burn(burn_usdi_context, usdi_liquidity_value.to_u64())?;
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, iasset_liquidity_value.to_u64())?;

            // find the amount of surplus usdi
            let usdi_surplus_value = usdi_liquidity_value.sub(usdi_burn_value).unwrap();

            // check if sufficient collateral exists within the vault
            if collateral.vault_usdi_supply.lt(usdi_surplus_value).unwrap() {
                return Err(InceptError::InsufficientUSDiCollateral.into());
            }
            // subtract amount from vault usdi supply and move to comet supply
            token_data.collaterals[collateral_index as usize].vault_usdi_supply = collateral
                .vault_usdi_supply
                .sub(
                    usdi_surplus_value
                        .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                )
                .unwrap();
            token_data.collaterals[collateral_index as usize].vault_comet_supply = collateral
                .vault_comet_supply
                .add(
                    usdi_surplus_value
                        .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                )
                .unwrap();

            // add collateral amount to total collateral amount
            comet.total_collateral_amount = comet
                .total_collateral_amount
                .add(usdi_surplus_value)
                .unwrap();

            // find the index of the collateral within the comet holder's position
            let comet_collateral_index = comet.get_collateral_index(collateral_index);

            // check to see if a new collateral must be added to the position
            if comet_collateral_index == usize::MAX {
                comet.add_collateral(CometCollateral {
                    authority: *ctx.accounts.user.to_account_info().key,
                    collateral_amount: usdi_surplus_value
                        .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                    collateral_index: collateral_index.into(),
                });
            } else {
                comet.collaterals[comet_collateral_index].collateral_amount = comet.collaterals
                    [comet_collateral_index]
                    .collateral_amount
                    .add(
                        usdi_surplus_value
                            .scale_to(collateral.vault_comet_supply.scale.try_into().unwrap()),
                    )
                    .unwrap();
            }
        } else {
            // burn liquidity from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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
            token::burn(burn_usdi_context, usdi_amount)?;
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            token::burn(burn_iasset_context, iasset_liquidity_value.to_u64())?;
        }

        // burn liquidity tokens from comet
        let cpi_accounts = Burn {
            mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .comet_liquidity_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let burn_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::burn(
            burn_liquidity_tokens_to_comet_context,
            liquidity_token_value.to_u64(),
        )?;

        // update pool data
        token_data.pools[comet_position.pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn recenter_comet(
        ctx: Context<RecenterComet>,
        manager_nonce: u8,
        comet_position_index: u8,
        comet_collateral_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_position = comet.positions[comet_position_index as usize];

        let collateral = comet.collaterals[comet_collateral_index as usize];

        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate usdi and iasset comet can claim right now
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            comet_position.liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

        // check if the price has moved significantly
        if (iasset_value.lt(comet_position.borrowed_iasset).unwrap()
            && usdi_value.lt(comet_position.borrowed_usdi).unwrap())
            || (iasset_value.gt(comet_position.borrowed_iasset).unwrap()
                && usdi_value.gt(comet_position.borrowed_usdi).unwrap())
        {
            // price has NOT moved significantly throw error
            return Err(InceptError::NoPriceDeviationDetected.into());
        }

        // calculate initial comet pool price
        let initial_comet_price =
            calculate_amm_price(comet_position.borrowed_iasset, comet_position.borrowed_usdi);
        // calculate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // check if price has increased since comet was initialized
        if initial_comet_price.lt(current_price).unwrap() {
            // calculate extra usdi comet can claim, iasset debt that comet cannot claim, and usdi amount needed to buy iasset and cover debt
            let (usdi_surplus, usdi_amount, iasset_debt) =
                calculate_recentering_values_with_usdi_surplus(
                    comet_position.borrowed_iasset,
                    comet_position.borrowed_usdi,
                    iasset_amm_value,
                    usdi_amm_value,
                    comet_position.liquidity_token_value,
                    liquidity_token_supply,
                );
            // calculate the amount of additional usdi, otherwise known as the recentering fee, in order to recenter the position
            let collateral_recentering_fee = usdi_amount
                .sub(usdi_surplus)
                .unwrap()
                .scale_to(collateral.collateral_amount.scale.try_into().unwrap());

            // recalculate the amount of collateral claimable by the comet
            let new_collateral_amount = collateral
                .collateral_amount
                .sub(collateral_recentering_fee)
                .unwrap();

            // recalculate amount of iasset the comet has borrowed
            let new_borrowed_iasset = comet_position.borrowed_iasset.sub(iasset_debt).unwrap();

            // recalculate amount of usdi the comet has borrowed
            let new_borrowed_usdi = comet_position.borrowed_usdi.add(usdi_surplus).unwrap();

            // update comet data
            comet.collaterals[comet_collateral_index as usize].collateral_amount =
                new_collateral_amount;
            comet.total_collateral_amount = comet
                .total_collateral_amount
                .sub(collateral_recentering_fee.scale_to(DEVNET_TOKEN_SCALE))
                .unwrap();
            comet.positions[comet_position_index as usize].borrowed_iasset = new_borrowed_iasset;
            comet.positions[comet_position_index as usize].borrowed_usdi = new_borrowed_usdi;

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
            token::mint_to(mint_usdi_context, usdi_amount.to_u64())?;

            // burn iasset from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(burn_iasset_context, iasset_debt.to_u64())?;
        } else if initial_comet_price.gt(current_price).unwrap() {
            // calculate extra iasset comet can claim, usdi debt that comet cannot claim, and iasset amount needed to buy usdi and cover debt
            let (iasset_surplus, iasset_amount, usdi_debt) =
                calculate_recentering_values_with_iasset_surplus(
                    comet_position.borrowed_iasset,
                    comet_position.borrowed_usdi,
                    iasset_amm_value,
                    usdi_amm_value,
                    comet_position.liquidity_token_value,
                    liquidity_token_supply,
                );

            // calculate the amount of additional iassset, otherwise known as the recentering fee, in order to recenter the position
            let collateral_recentering_fee = iasset_amount
                .sub(iasset_surplus)
                .unwrap()
                .scale_to(collateral.collateral_amount.scale.try_into().unwrap());

            // recalculate amount of iasset the comet has borrowed
            let new_borrowed_iasset = comet_position.borrowed_iasset.add(iasset_surplus).unwrap();

            // recalculate amount of usdi the comet has borrowed
            let new_borrowed_usdi = comet_position.borrowed_usdi.sub(usdi_debt).unwrap();

            // update comet data
            comet.positions[comet_position_index as usize].borrowed_iasset = new_borrowed_iasset;
            comet.positions[comet_position_index as usize].borrowed_usdi = new_borrowed_usdi;

            // burn iasset from user
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            };
            let burn_iasset_context = CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
            );

            token::burn(burn_iasset_context, collateral_recentering_fee.to_u64())?;

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
            token::mint_to(mint_iasset_context, iasset_amount.to_u64())?;

            // burn usdi from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
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

            token::burn(burn_usdi_context, usdi_debt.to_u64())?;
        } else {
            return Err(InceptError::NoPriceDeviationDetected.into());
        }

        // update pool data
        token_data.pools[comet_position.pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn close_comet_position(
        ctx: Context<CloseCometPosition>,
        manager_nonce: u8,
        comet_position_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_position = comet.positions[comet_position_index as usize];

        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status == 2u64 { // Fully
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // calculate initial comet pool price
        let initial_comet_price =
            calculate_amm_price(comet_position.borrowed_iasset, comet_position.borrowed_usdi);
        // calculate current pool price
        let current_market_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // calculate usdi and iasset comet can claim right now
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            comet_position.liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

        // check if the price has moved significantly
        if (iasset_value.lt(comet_position.borrowed_iasset).unwrap()
            && usdi_value.lt(comet_position.borrowed_usdi).unwrap())
            || (iasset_value.gt(comet_position.borrowed_iasset).unwrap()
                && usdi_value.gt(comet_position.borrowed_usdi).unwrap())
        {
            // price has NOT moved significantly
            // burn liquidity tokens from comet to recover liquidity
            let cpi_accounts = Burn {
                mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_liquidity_tokens_from_comet_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_liquidity_tokens_from_comet_context,
                comet_position.liquidity_token_value.to_u64(),
            )?;

            // burn iasset from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_from_amm_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_iasset_from_amm_context,
                comet_position.borrowed_iasset.to_u64(),
            )?;

            // burn usdi from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_usdi_from_amm_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_usdi_from_amm_context,
                comet_position.borrowed_usdi.to_u64(),
            )?;
        }
        // check if price has increased since comet was initialized
        else if initial_comet_price.lt(current_market_price).unwrap() {
            //calculate impermanent loss
            let iasset_impermanent_loss = comet_position.borrowed_iasset.sub(iasset_value).unwrap();

            // burn iasset from user to pay back impermanent loss
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            };
            let burn_iasset_from_user_context = CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
            );

            token::burn(
                burn_iasset_from_user_context,
                iasset_impermanent_loss.to_u64(),
            )?;

            // burn liquidity tokens from comet to recover liquidity
            let cpi_accounts = Burn {
                mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_liquidity_tokens_from_comet_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_liquidity_tokens_from_comet_context,
                comet_position.liquidity_token_value.to_u64(),
            )?;

            // burn iasset from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_from_amm_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(burn_iasset_from_amm_context, iasset_value.to_u64())?;

            // burn usdi from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_usdi_from_amm_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_usdi_from_amm_context,
                comet_position.borrowed_usdi.to_u64(),
            )?;

            // transfer surplus usdi from the amm to the user
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
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_usdi_to_user_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_usdi_to_user_context,
                usdi_value
                    .sub(comet_position.borrowed_usdi)
                    .unwrap()
                    .to_u64(),
            )?;
        } else {
            // price has decreased since comet was initialized
            // calculate impermanent loss
            let usdi_impermanent_loss = comet_position.borrowed_usdi.sub(usdi_value).unwrap();

            // burn usdi from the user to pay back impermanent loss
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.user.to_account_info().clone(),
            };
            let burn_usdi_from_user_context = CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
            );

            token::burn(burn_usdi_from_user_context, usdi_impermanent_loss.to_u64())?;

            // burn liquidity tokens from comet to recover liquidity
            let cpi_accounts = Burn {
                mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .comet_liquidity_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_liquidity_tokens_from_comet_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_liquidity_tokens_from_comet_context,
                comet_position.liquidity_token_value.to_u64(),
            )?;

            // burn usdi from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_usdi_from_amm_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(burn_usdi_from_amm_context, usdi_value.to_u64())?;

            // burn iasset from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_iasset_from_amm_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_iasset_from_amm_context,
                comet_position.borrowed_iasset.to_u64(),
            )?;

            // transfer surplus iasset from the amm to the user
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
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_iasset_to_user_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_iasset_to_user_context,
                iasset_value
                    .sub(comet_position.borrowed_iasset)
                    .unwrap()
                    .to_u64(),
            )?;
        }

        // remove comet pool
        comet.remove_position(comet_position_index as usize);

        // update pool data
        token_data.pools[comet_position.pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn mint_usdi_hackathon(
        ctx: Context<MintUSDIHackathon>,
        manager_nonce: u8,
        amount: u64,
    ) -> ProgramResult {
        //This instruction is for hackathon use ONLY!!!!
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        // mint usdi to user
        let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx_mint, amount)?;

        Ok(())
    }

    pub fn liquidate_mint_position(
        ctx: Context<LiquidateMintPosition>,
        manager_nonce: u8,
        mint_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let token_data = &mut ctx.accounts.token_data.load()?;
        let mint_positions = ctx.accounts.mint_positions.load_mut()?;
        let mint_position = mint_positions.mint_positions[mint_index as usize];

        let collateral = token_data.collaterals[mint_position.collateral_index as usize];
        let pool = token_data.pools[mint_position.pool_index as usize];
        // Check if this position is valid for liquidation
        if collateral.stable == 0 {
            return Err(InceptError::NonStablesNotSupported.into());
        }

        // ensure price data is up to date
        let slot = Clock::get()?.slot;
        check_feed_update(pool.asset_info, slot).unwrap();

        let borrowed_iasset = mint_position.borrowed_iasset.scale_to(DEVNET_TOKEN_SCALE);
        let collateral_amount_value = mint_position.collateral_amount.scale_to(DEVNET_TOKEN_SCALE);

        // Should fail here.
        if check_mint_collateral_sufficient(
            pool.asset_info,
            borrowed_iasset,
            pool.asset_info.stable_collateral_ratio,
            collateral_amount_value,
            slot,
        )
        .is_ok()
        {
            return Err(InceptError::MintPositionUnableToLiquidate.into());
        }

        // Burn the iAsset from the liquidator
        let cpi_accounts = Burn {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .liquidator_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.liquidator.to_account_info().clone(),
        };
        let burn_liquidator_iasset_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
        );

        token::burn(
            burn_liquidator_iasset_context,
            mint_position.borrowed_iasset.to_u64(),
        )?;

        // Send the user the remaining collateral.
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info().clone(),
            to: ctx
                .accounts
                .liquidator_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_usdc_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::transfer(send_usdc_context, mint_position.collateral_amount.to_u64())?;

        Ok(())
    }

    pub fn liquidate_comet_position_reduction(
        ctx: Context<LiquidateCometPositionReduction>,
        manager_nonce: u8,
        position_index: u8,
        lp_token_reduction: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let mut token_data = ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;

        // Require a healthy score after transactions
        let health_score = math::calculate_health_score(&comet, &token_data)?;

        require!(
            matches!(health_score, math::HealthScore::SubjectToLiquidation { .. }),
            error::InceptError::NotSubjectToLiquidation
        );

        let comet_position = comet.positions[position_index as usize];

        require!(
            comet_position.borrowed_usdi.val > 0,
            error::InceptError::NotSubjectToLiquidation
        );
    
        let pool = token_data.pools[comet_position.pool_index as usize];

        let pool_price = pool.usdi_amount.div(pool.iasset_amount);
        let init_price = comet_position
            .borrowed_usdi
            .div(comet_position.borrowed_iasset);

        require!(
            lp_token_reduction <= comet_position.liquidity_token_value.to_u64(),
            error::InceptError::LiquidationAmountTooLarge
        );

        let lp_token_reduction = Value::new(lp_token_reduction.into(), comet_position.liquidity_token_value.scale.try_into().unwrap());

        let usdi_reduction_amount = lp_token_reduction
            .mul(pool.usdi_amount)
            .div(pool.liquidity_token_supply);

        let iasset_reduction_amount = lp_token_reduction
            .mul(pool.iasset_amount)
            .div(pool.liquidity_token_supply);

        msg!("DATA: {:?}, {:?}, {:?}, {:?}", usdi_reduction_amount.to_scaled_f64(), comet_position.borrowed_usdi.to_scaled_f64(), iasset_reduction_amount.to_scaled_f64(), comet_position.borrowed_iasset.to_scaled_f64());

        // Calculate amounts to burn for LP tokens, usdi and iAsset
        if pool_price.gt(init_price)? {
            // Price went up, IL in iAsset, burn all iasset and reward some usdi
            let usdi_position_reduction = lp_token_reduction
                .div(comet_position.liquidity_token_value)
                .mul(comet_position.borrowed_usdi);
            let usdi_reward = usdi_reduction_amount.sub(usdi_position_reduction)?;

            let iasset_position_reduction = if iasset_reduction_amount.gt(comet_position.borrowed_iasset)? {
                comet_position.borrowed_iasset
            } else {
                iasset_reduction_amount
            };

            // Remove from borrowed positions
            comet.positions[position_index as usize].borrowed_usdi =
                comet_position.borrowed_usdi.sub(usdi_position_reduction)?;
            comet.positions[position_index as usize].borrowed_iasset = comet_position
                .borrowed_iasset
                .sub(iasset_position_reduction)?;

            msg!("FINAL IASSET POSITION: {}", comet.positions[position_index as usize].borrowed_iasset.to_scaled_f64());

            // Mint usdi reward and give to liquidator,
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
                    seeds
                ),
                usdi_reward.to_u64(),
            )?;
        } else {
            // Price went down, IL in USDi. burn all usdi and reward some iasset
            let iasset_position_reduction = lp_token_reduction
                .div(comet_position.liquidity_token_value)
                .mul(comet_position.borrowed_iasset);
            let iasset_reward = iasset_reduction_amount.sub(iasset_position_reduction)?;

            let usdi_position_reduction = if usdi_reduction_amount.gt(comet_position.borrowed_usdi)? {
                comet_position.borrowed_usdi
            } else {
                usdi_reduction_amount
            };
            // Remove from borrowed positions
            comet.positions[position_index as usize].borrowed_usdi =
                comet_position.borrowed_usdi.sub(usdi_position_reduction)?;
            comet.positions[position_index as usize].borrowed_iasset = comet_position
                .borrowed_iasset
                .sub(iasset_position_reduction)?;

            // Mint iasset reward and give to liquidator,
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
                iasset_reward.to_u64(),
            )?;
        }
        // Remove LP tokens from position.
        comet.positions[position_index as usize].liquidity_token_value = comet_position
            .liquidity_token_value
            .sub(lp_token_reduction)?;

        // Burn USDi, iAsset and LP from pool
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_usdi_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds
            ),
            usdi_reduction_amount.to_u64(),
        )?;

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Burn {
                    mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .amm_iasset_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds
            ),
            iasset_reduction_amount.to_u64(),
        )?;

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Burn {
                    mint: ctx.accounts.liquidity_token_mint.to_account_info().clone(),
                    to: ctx
                        .accounts
                        .comet_liquidity_token_account
                        .to_account_info()
                        .clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                },
                seeds,
            ),
            lp_token_reduction.to_u64(),
        )?;
        // update pool data
        token_data.pools[comet_position.pool_index as usize].iasset_amount = pool.iasset_amount.sub(iasset_reduction_amount)?;
        token_data.pools[comet_position.pool_index as usize].usdi_amount =  pool.usdi_amount.sub(usdi_reduction_amount)?;
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply = pool.liquidity_token_supply.sub(lp_token_reduction)?;
        
        let position_term = comet.positions[position_index as usize]
            .borrowed_usdi
            .mul(pool.asset_info.health_score_coefficient)
            .div(comet.total_collateral_amount)
            .to_scaled_f64();

        let resulting_score = match health_score {
            math::HealthScore::Healthy { score } => score + position_term,
            math::HealthScore::SubjectToLiquidation { score } => score + position_term,
        };
        //msg!("Resulting score: {}", resulting_score);

        require!(
            resulting_score < token_data.il_health_score_cutoff.to_scaled_f64(),
            error::InceptError::LiquidationAmountTooLarge
        );

        Ok(())
    }

    pub fn liquidate_comet_il_reduction(
        ctx: Context<LiquidateCometILReduction>,
        manager_nonce: u8,
        usdi_collateral_index: u8,
        position_index: u8,
        il_reduction_amount: u64
    ) -> ProgramResult {

        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let mut token_data = ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;

        // Require a healthy score after transactions
        let health_score = math::calculate_health_score(&comet, &token_data)?;
        
        require!(
            matches!(health_score, math::HealthScore::SubjectToLiquidation {..}),
            error::InceptError::NotSubjectToLiquidation
        );

        // Check that all LP positions are zero, also if there are USDi LP positions.
        let mut exists_usdi_il = false;
        for i in 0..comet.num_positions {

            let position = comet.positions[i as usize];
            
            if position.liquidity_token_value.val != 0u128 {
                return Err(error::InceptError::NotSubjectToILLiquidation.into())
            }
            if position.borrowed_usdi.gt(position.borrowed_iasset)? {
                exists_usdi_il = true;
            }
        }
        // Look at current position:
        let position = comet.positions[position_index as usize];
        let position_is_usdi_il = position.borrowed_usdi.gt(position.borrowed_iasset)?;

        if !position_is_usdi_il && exists_usdi_il{
            return Err(error::InceptError::NotSubjectToILLiquidation.into())
        }

        let collateral_comet_index = comet.get_collateral_index(usdi_collateral_index);
        let collateral = comet.collaterals[collateral_comet_index];

        let pool = token_data.pools[position.pool_index as usize];

        if position_is_usdi_il {
            let impermanent_loss_usdi = position.borrowed_usdi;

            require!(
                il_reduction_amount <= impermanent_loss_usdi.to_u64(),
                error::InceptError::LiquidationAmountTooLarge
            );

            let liquidation_value = Value::new(il_reduction_amount.into(), impermanent_loss_usdi.scale.try_into().unwrap());
            let total_usdi_required = liquidation_value.mul(token_data.il_liquidation_reward_pct);
            let usdi_reward = total_usdi_required.sub(liquidation_value)?;

            // remove total_usdi_required from comet, comet collateral and token data
            comet.collaterals[collateral_comet_index].collateral_amount = collateral.collateral_amount.sub(total_usdi_required)?;
            comet.total_collateral_amount = comet.total_collateral_amount.sub(total_usdi_required)?;
            token_data.collaterals[usdi_collateral_index as usize].vault_comet_supply = token_data.collaterals[usdi_collateral_index as usize].vault_comet_supply.sub(total_usdi_required)?;
            // Vault usdi supply
            // Burn USDi from vault.
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        to: ctx
                            .accounts
                            .vault
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                total_usdi_required.to_u64(),
            )?;

            // reduce borrowed_usdi by il value
            comet.positions[position_index as usize].borrowed_usdi = position.borrowed_usdi.sub(liquidation_value)?;

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
                usdi_reward.to_u64(),
            )?;

        } else {
            let impermanent_loss_iasset = position.borrowed_iasset;
            msg!("{:?}, {:?} {:?}", position.borrowed_usdi.to_scaled_f64(), il_reduction_amount, position.borrowed_iasset.to_scaled_f64());
            require!(
                il_reduction_amount <= impermanent_loss_iasset.to_u64(),
                error::InceptError::LiquidationAmountTooLarge
            );

            let liquidation_value = Value::new(il_reduction_amount.into(), impermanent_loss_iasset.scale.try_into().unwrap());
            
            // calculate how much usdi must be spent
            let impermanent_loss_usdi = calculate_price_from_iasset(
                liquidation_value,
                pool.iasset_amount,
                pool.usdi_amount,
                true,
            )?;

            let total_usdi_required = impermanent_loss_usdi.mul(token_data.il_liquidation_reward_pct);
            let usdi_reward = total_usdi_required.sub(impermanent_loss_usdi)?;

            comet.collaterals[collateral_comet_index].collateral_amount = collateral.collateral_amount.sub(total_usdi_required)?;
            comet.total_collateral_amount = comet.total_collateral_amount.sub(total_usdi_required)?;
            token_data.collaterals[usdi_collateral_index as usize].vault_comet_supply = token_data.collaterals[usdi_collateral_index as usize].vault_comet_supply.sub(total_usdi_required)?;

            // Burn USDi from vault.
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        to: ctx
                            .accounts
                            .vault
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                total_usdi_required.to_u64(),
            )?;

            // Mint USDi into AMM
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
                impermanent_loss_usdi.to_u64(),
            )?;

            // Burn IAsset from AMM
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
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
                liquidation_value.to_u64(),
            )?;

            // Reduce borrowed IAsset since it's paid down.
            comet.positions[position_index as usize].borrowed_iasset = position.borrowed_iasset.sub(liquidation_value)?;

            // Mint usdi reward to liquidator
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
                usdi_reward.to_u64(),
            )?;
        }

        let resulting_score = match math::calculate_health_score(&comet, &token_data)? {
            math::HealthScore::Healthy { score } => score,
            math::HealthScore::SubjectToLiquidation { score } => score,
        };

        require!(
            resulting_score <= 20f64,
            error::InceptError::LiquidationAmountTooLarge
        );

        Ok(())
    }
}


