use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Transfer};
use chainlink_solana as chainlink;
use error::*;
use instructions::*;
use pyth::pc::Price;
use states::{
    AssetInfo, Collateral, CometLiquidation, CometPosition, LiquidationStatus, LiquidityPosition,
    MintPosition, MultiPoolCometCollateral, MultiPoolCometPosition, Pool, TokenData, Value,
};

mod error;
mod instructions;
mod math;
mod states;
mod value;

use crate::value::Div;

declare_id!("4RCgZyehQFKVBEnXf1ZfKksAL3YFbwCKqUmbwpQx7eHf");

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

        // set manager as token data owner
        token_data.manager = *ctx.accounts.manager.to_account_info().key;
        token_data.chainlink_program = *ctx.accounts.chainlink_program.to_account_info().key;
        token_data.il_health_score_coefficient =
            Value::new(_il_health_score_coefficient.into(), DEVNET_TOKEN_SCALE);

        Ok(())
    }

    pub fn update_il_health_score_coefficient(
        ctx: Context<UpdateILHealthScoreCoefficient>,
        _manager_nonce: u8,
        _il_health_score_coefficient: u64,
    ) -> ProgramResult {
        require!(
            _il_health_score_coefficient > 0,
            InceptError::InvalidHealthScoreCoefficient
        );
        let mut token_data = ctx.accounts.token_data.load_init()?;
        token_data.il_health_score_coefficient =
            Value::new(_il_health_score_coefficient.into(), DEVNET_TOKEN_SCALE);

        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>, _user_nonce: u8) -> ProgramResult {
        let mut comet_positions = ctx.accounts.comet_positions.load_init()?;
        let mut mint_positions = ctx.accounts.mint_positions.load_init()?;
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_init()?;
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_init()?;

        // set user data
        ctx.accounts.user_account.authority = *ctx.accounts.user.to_account_info().key;
        ctx.accounts.user_account.comet_positions =
            *ctx.accounts.comet_positions.to_account_info().key;
        ctx.accounts.user_account.mint_positions =
            *ctx.accounts.mint_positions.to_account_info().key;
        ctx.accounts.user_account.liquidity_positions =
            *ctx.accounts.liquidity_positions.to_account_info().key;
        ctx.accounts.user_account.multi_pool_comet =
            *ctx.accounts.multi_pool_comet.to_account_info().key;

        // set user as comet, mint, and liquidity positions owner
        comet_positions.owner = *ctx.accounts.user.to_account_info().key;
        mint_positions.owner = *ctx.accounts.user.to_account_info().key;
        liquidity_positions.owner = *ctx.accounts.user.to_account_info().key;
        multi_pool_comet.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn add_collateral(
        ctx: Context<AddCollateral>,
        _manager_nonce: u8,
        scale: u8,
        stable: u8,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut pool_index: u8 = 0;

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
        health_score_coefficient: u64,
    ) -> ProgramResult {
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
        require!(
            health_score_coefficient > 0,
            InceptError::InvalidHealthScoreCoefficient
        );
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
            )
            .unwrap();
            let pyth_price = Value::new(price_feed.agg.price.try_into().unwrap(), expo_u8);
            let confidence = Value::new(price_feed.agg.conf.try_into().unwrap(), expo_u8);
            // ensure prices have proper confidence
            check_price_confidence(pyth_price, confidence).unwrap();

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

        // check to see if mint is empty, if so remove
        if mint_positions.mint_positions[mint_index as usize]
            .borrowed_iasset
            .to_u64()
            == 0
        {
            mint_positions.remove(mint_index as usize);
        }

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
            );

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
            );

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
        );

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
        );

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

        token::transfer(send_iasset_to_user_context, amount)?;

        // update pool data
        token_data.pools[pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
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
        );

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

        token::transfer(send_usdi_to_user_context, usdi_amount_value.to_u64())?;

        // update pool data
        token_data.pools[pool_index as usize].iasset_amount = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[pool_index as usize].usdi_amount = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        Ok(())
    }

    pub fn initialize_comet(
        ctx: Context<InitializeComet>,
        manager_nonce: u8,
        pool_index: u8,
        collateral_amount: u64,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut &mut ctx.accounts.token_data.load_mut()?;

        let (collateral, collateral_index) =
            TokenData::get_collateral_tuple(token_data, *ctx.accounts.vault.to_account_info().key)
                .unwrap();

        let collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale.try_into().unwrap(),
        );

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index].vault_comet_supply =
            collateral.vault_comet_supply.add(collateral_value).unwrap();

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
            );

        // generate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // calculate comet range
        let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
            usdi_liquidity_value,
            iasset_liquidity_value,
            collateral_value.scale_to(DEVNET_TOKEN_SCALE),
            iasset_amm_value,
            usdi_amm_value,
        );

        // throw error if the comet is out of range
        if lower_price_range.gte(current_price).unwrap()
            || upper_price_range.lte(current_price).unwrap()
        {
            return Err(InceptError::InvalidCometCollateralRatio.into());
        }

        // lock collateral in vault
        let cpi_ctx: CpiContext<Transfer> = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx, collateral_amount)?;

        // mint usdi to amm
        let cpi_accounts = MintTo {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_usdi_to_amm_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::mint_to(mint_usdi_to_amm_context, usdi_amount)?;

        // mint iasset to amm
        let cpi_accounts = MintTo {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_iasset_to_amm_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::mint_to(mint_iasset_to_amm_context, iasset_liquidity_value.to_u64())?;

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

        // set comet data
        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let num_positions = comet_positions.num_positions;

        comet_positions.comet_positions[num_positions as usize] = CometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            collateral_amount: collateral_value,
            pool_index: pool_index as u64,
            collateral_index: collateral_index.try_into().unwrap(),
            borrowed_usdi: usdi_liquidity_value,
            borrowed_iasset: iasset_liquidity_value,
            liquidity_token_value: liquidity_token_value,
            lower_price_range: lower_price_range,
            upper_price_range: upper_price_range,
            comet_liquidation: CometLiquidation {
                ..Default::default()
            },
        };

        comet_positions.num_positions += 1;

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

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        _manager_nonce: u8,
        comet_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        let collateral = token_data.collaterals[comet_position.collateral_index as usize];

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status == LiquidationStatus::Fully {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        let added_collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale.try_into().unwrap(),
        );

        // add collateral amount to vault supply
        token_data.collaterals[comet_position.collateral_index as usize].vault_comet_supply =
            collateral
                .vault_comet_supply
                .add(added_collateral_value)
                .unwrap();

        // add collateral amount to comet position
        comet_positions.comet_positions[comet_index as usize].collateral_amount = comet_position
            .collateral_amount
            .add(added_collateral_value)
            .unwrap();

        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate comet range
        let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
            comet_position.borrowed_usdi,
            comet_position.borrowed_iasset,
            comet_positions.comet_positions[comet_index as usize]
                .collateral_amount
                .scale_to(DEVNET_TOKEN_SCALE),
            iasset_amm_value,
            usdi_amm_value,
        );

        // reset price range
        comet_positions.comet_positions[comet_index as usize].lower_price_range = lower_price_range;
        comet_positions.comet_positions[comet_index as usize].upper_price_range = upper_price_range;

        // send collateral from user to vault
        let cpi_ctx = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx, collateral_amount)?;

        Ok(())
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        manager_nonce: u8,
        comet_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        let collateral = token_data.collaterals[comet_position.collateral_index as usize];

        let withdrawn_collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale.try_into().unwrap(),
        );

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status != LiquidationStatus::Healthy {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // subtract collateral amount from vault supply
        token_data.collaterals[comet_position.collateral_index as usize].vault_comet_supply =
            collateral
                .vault_comet_supply
                .sub(withdrawn_collateral_value)
                .unwrap();

        // subtract collateral amount from comet position
        comet_positions.comet_positions[comet_index as usize].collateral_amount = comet_position
            .collateral_amount
            .sub(withdrawn_collateral_value)
            .unwrap();

        let iasset_amm_value = Value::new(
            ctx.accounts.amm_iasset_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );
        let usdi_amm_value = Value::new(
            ctx.accounts.amm_usdi_token_account.amount.into(),
            DEVNET_TOKEN_SCALE,
        );

        // calculate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // calculate comet price range
        let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
            comet_position.borrowed_usdi,
            comet_position.borrowed_iasset,
            comet_positions.comet_positions[comet_index as usize]
                .collateral_amount
                .scale_to(DEVNET_TOKEN_SCALE),
            iasset_amm_value,
            usdi_amm_value,
        );

        // throw error if the comet is out of range
        if lower_price_range.gte(current_price).unwrap()
            || upper_price_range.lte(current_price).unwrap()
        {
            return Err(InceptError::InvalidCometCollateralRatio.into());
        }

        // reset price range
        comet_positions.comet_positions[comet_index as usize].lower_price_range = lower_price_range;
        comet_positions.comet_positions[comet_index as usize].upper_price_range = upper_price_range;

        // send collateral from user to comet
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::transfer(cpi_ctx, collateral_amount)?;

        Ok(())
    }

    pub fn add_liquidity_to_comet(
        ctx: Context<AddLiquidityToComet>,
        manager_nonce: u8,
        comet_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        let collateral_value = comet_position.collateral_amount;

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
            );

        // generate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // calculate comet range
        let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
            comet_position
                .borrowed_usdi
                .add(usdi_liquidity_value)
                .unwrap(),
            comet_position
                .borrowed_iasset
                .add(iasset_liquidity_value)
                .unwrap(),
            collateral_value.scale_to(DEVNET_TOKEN_SCALE),
            iasset_amm_value,
            usdi_amm_value,
        );

        // throw error if the comet is out of range
        if lower_price_range.gte(current_price).unwrap()
            || upper_price_range.lte(current_price).unwrap()
        {
            return Err(InceptError::InvalidCometCollateralRatio.into());
        }

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status == LiquidationStatus::Fully {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // update comet position data
        comet_positions.comet_positions[comet_index as usize].borrowed_usdi = comet_position
            .borrowed_usdi
            .add(usdi_liquidity_value)
            .unwrap();
        comet_positions.comet_positions[comet_index as usize].borrowed_iasset = comet_position
            .borrowed_iasset
            .add(iasset_liquidity_value)
            .unwrap();
        comet_positions.comet_positions[comet_index as usize].liquidity_token_value =
            comet_position
                .liquidity_token_value
                .add(liquidity_token_value)
                .unwrap();
        comet_positions.comet_positions[comet_index as usize].lower_price_range = lower_price_range;
        comet_positions.comet_positions[comet_index as usize].upper_price_range = upper_price_range;

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

    pub fn withdraw_liquidity_from_comet(
        ctx: Context<WithdrawLiquidityFromComet>,
        manager_nonce: u8,
        comet_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        let collateral_value = comet_position.collateral_amount;

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
            );

        // calculate comet range
        let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
            comet_position
                .borrowed_usdi
                .sub(usdi_liquidity_value)
                .unwrap(),
            comet_position
                .borrowed_iasset
                .sub(iasset_liquidity_value)
                .unwrap(),
            collateral_value.scale_to(DEVNET_TOKEN_SCALE),
            iasset_amm_value,
            usdi_amm_value,
        );

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status == LiquidationStatus::Fully {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // update comet position data
        comet_positions.comet_positions[comet_index as usize].borrowed_usdi = comet_position
            .borrowed_usdi
            .sub(usdi_liquidity_value)
            .unwrap();
        comet_positions.comet_positions[comet_index as usize].borrowed_iasset = comet_position
            .borrowed_iasset
            .sub(iasset_liquidity_value)
            .unwrap();
        comet_positions.comet_positions[comet_index as usize].liquidity_token_value =
            comet_position
                .liquidity_token_value
                .sub(liquidity_token_value)
                .unwrap();
        comet_positions.comet_positions[comet_index as usize].lower_price_range = lower_price_range;
        comet_positions.comet_positions[comet_index as usize].upper_price_range = upper_price_range;

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

    pub fn close_comet(
        ctx: Context<CloseComet>,
        manager_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

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
        // if comet_position.comet_liquidation.status != LiquidationStatus::Fully {
        //     return Err(InceptError::CometAlreadyLiquidated.into());
        // }

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
        );

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

        // unlock comet collateral from vault and send to user
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info().clone(),
            to: ctx
                .accounts
                .user_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_usdc_to_user_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::transfer(
            send_usdc_to_user_context,
            comet_position.collateral_amount.to_u64(),
        )?;

        // update collateral vault supply
        token_data.collaterals
            [comet_positions.comet_positions[comet_index as usize].collateral_index as usize]
            .vault_comet_supply = token_data.collaterals
            [comet_positions.comet_positions[comet_index as usize].collateral_index as usize]
            .vault_comet_supply
            .sub(comet_position.collateral_amount)
            .unwrap();

        // remove comet from user list
        comet_positions.remove(comet_index as usize);

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
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

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
        if comet_position.comet_liquidation.status == LiquidationStatus::Fully {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // calculate usdi and iasset comet can claim right now
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            comet_position.liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        );

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
                .scale_to(comet_position.collateral_amount.scale.try_into().unwrap());

            // recalculate the amount of collateral claimable by the comet
            let new_collateral_amount = comet_position
                .collateral_amount
                .sub(collateral_recentering_fee)
                .unwrap();

            // recalculate amount of iasset the comet has borrowed
            let new_borrowed_iasset = comet_position.borrowed_iasset.sub(iasset_debt).unwrap();

            // recalculate amount of usdi the comet has borrowed
            let new_borrowed_usdi = comet_position.borrowed_usdi.add(usdi_surplus).unwrap();

            // calculate recentered comet range
            let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
                new_borrowed_usdi,
                new_borrowed_iasset,
                new_collateral_amount.scale_to(DEVNET_TOKEN_SCALE),
                iasset_amm_value,
                usdi_amm_value,
            );

            // throw error if the price is out of range
            if lower_price_range.gte(current_price).unwrap()
                || upper_price_range.lte(current_price).unwrap()
            {
                return Err(InceptError::InvalidCometCollateralRatio.into());
            }

            // update comet data
            comet_positions.comet_positions[comet_index as usize].lower_price_range =
                lower_price_range;
            comet_positions.comet_positions[comet_index as usize].upper_price_range =
                upper_price_range;
            comet_positions.comet_positions[comet_index as usize].collateral_amount =
                new_collateral_amount;
            comet_positions.comet_positions[comet_index as usize].borrowed_iasset =
                new_borrowed_iasset;
            comet_positions.comet_positions[comet_index as usize].borrowed_usdi = new_borrowed_usdi;

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
        } else {
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
                .scale_to(comet_position.collateral_amount.scale.try_into().unwrap());

            // recalculate amount of iasset the comet has borrowed
            let new_borrowed_iasset = comet_position.borrowed_iasset.add(iasset_surplus).unwrap();

            // recalculate amount of usdi the comet has borrowed
            let new_borrowed_usdi = comet_position.borrowed_usdi.sub(usdi_debt).unwrap();

            // calculate recentered comet range
            let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
                new_borrowed_usdi,
                new_borrowed_iasset,
                comet_position
                    .collateral_amount
                    .scale_to(DEVNET_TOKEN_SCALE),
                iasset_amm_value,
                usdi_amm_value,
            );
            // throw error if the price is out of range
            if lower_price_range.gte(current_price).unwrap()
                || upper_price_range.lte(current_price).unwrap()
            {
                return Err(InceptError::InvalidCometCollateralRatio.into());
            }

            // update comet data
            comet_positions.comet_positions[comet_index as usize].lower_price_range =
                lower_price_range;
            comet_positions.comet_positions[comet_index as usize].upper_price_range =
                upper_price_range;
            comet_positions.comet_positions[comet_index as usize].borrowed_iasset =
                new_borrowed_iasset;
            comet_positions.comet_positions[comet_index as usize].borrowed_usdi = new_borrowed_usdi;

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

    pub fn initialize_user_comet_manager_position(
        ctx: Context<InitializeUserCometManagerPosition>,
        _manager_nonce: u8,
    ) -> ProgramResult {
        let mut comet_manager = ctx.accounts.comet_manager.load_mut()?;

        // set user data
        ctx.accounts.user_account.is_manager = 1;
        ctx.accounts.user_account.comet_manager = *ctx.accounts.comet_manager.to_account_info().key;

        // set comet manager data
        comet_manager.owner = *ctx.accounts.user.to_account_info().key;

        Ok(())
    }

    pub fn initialize_multi_pool_comet_position(
        ctx: Context<InitializeMultiPoolCometPosition>,
        manager_nonce: u8,
        pool_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut &mut ctx.accounts.token_data.load_mut()?;

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
            );

        // mint usdi to amm
        let cpi_accounts = MintTo {
            mint: ctx.accounts.usdi_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_usdi_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_usdi_to_amm_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::mint_to(mint_usdi_to_amm_context, usdi_amount)?;

        // mint iasset to amm
        let cpi_accounts = MintTo {
            mint: ctx.accounts.iasset_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .amm_iasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_iasset_to_amm_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::mint_to(mint_iasset_to_amm_context, iasset_liquidity_value.to_u64())?;

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

        // add position to comet
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;
        multi_pool_comet.add_position(MultiPoolCometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            pool_index: pool_index as u64,
            borrowed_usdi: usdi_liquidity_value,
            borrowed_iasset: iasset_liquidity_value,
            liquidity_token_value: liquidity_token_value,
            comet_liquidation: CometLiquidation {
                ..Default::default()
            },
        });

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

    pub fn add_collateral_to_multi_pool_comet(
        ctx: Context<AddCollateralToMultiPoolComet>,
        _manager_nonce: u8,
        collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;

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

        // add collateral amount to total comet manager collateral amount
        multi_pool_comet.total_collateral_amount = multi_pool_comet
            .total_collateral_amount
            .scale_to(DEVNET_TOKEN_SCALE)
            .add(added_collateral_value.scale_to(DEVNET_TOKEN_SCALE))
            .unwrap();

        // find the index of the collateral within the manager's position
        let multi_pool_comet_collateral_index =
            multi_pool_comet.get_collateral_index(collateral_index);
        msg!("0");
        // check to see if a new collateral must be added to the position
        if multi_pool_comet_collateral_index == usize::MAX {
            msg!("1");
            multi_pool_comet.add_collateral(MultiPoolCometCollateral {
                authority: *ctx.accounts.user.to_account_info().key,
                collateral_amount: added_collateral_value,
                collateral_index: collateral_index.into(),
            });
            msg!("2");
        } else {
            msg!("0.5");
            multi_pool_comet.collaterals[multi_pool_comet_collateral_index].collateral_amount =
                multi_pool_comet.collaterals[multi_pool_comet_collateral_index]
                    .collateral_amount
                    .add(added_collateral_value)
                    .unwrap();
            msg!("1.5");
        }
        msg!("2");

        // send collateral from user to vault
        let cpi_ctx = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx, collateral_amount)?;

        Ok(())
    }

    pub fn withdraw_collateral_from_multi_pool_comet(
        ctx: Context<WithdrawCollateralFromMultiPoolComet>,
        manager_nonce: u8,
        collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;

        let collateral = token_data.collaterals[collateral_index as usize];

        let subtracted_collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale.try_into().unwrap(),
        );

        // subtract collateral amount to vault supply
        token_data.collaterals[collateral_index as usize].vault_comet_supply = collateral
            .vault_comet_supply
            .sub(subtracted_collateral_value)
            .unwrap();

        // subtract collateral amount to total comet manager collateral amount
        multi_pool_comet.total_collateral_amount = multi_pool_comet
            .total_collateral_amount
            .sub(subtracted_collateral_value.scale_to(DEVNET_TOKEN_SCALE))
            .unwrap();

        // find the index of the collateral within the manager's position
        let multi_pool_comet_collateral_index =
            multi_pool_comet.get_collateral_index(collateral_index);

        // check to see if the collateral position exists
        if multi_pool_comet_collateral_index == usize::MAX {
            return Err(InceptError::NoSuchCollateralPosition.into());
        }

        // ensure the position holds sufficient collateral
        if multi_pool_comet.collaterals[multi_pool_comet_collateral_index]
            .collateral_amount
            .lt(subtracted_collateral_value)
            .unwrap()
        {
            return Err(InceptError::InsufficientCollateral.into());
        }

        // update the collateral amount
        multi_pool_comet.collaterals[multi_pool_comet_collateral_index].collateral_amount =
            multi_pool_comet.collaterals[multi_pool_comet_collateral_index]
                .collateral_amount
                .sub(subtracted_collateral_value)
                .unwrap();

        // remove collateral if empty
        if multi_pool_comet.collaterals[multi_pool_comet_collateral_index]
            .collateral_amount
            .val
            == 0
        {
            multi_pool_comet.remove_collateral(multi_pool_comet_collateral_index)
        }

        // send collateral from vault to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::transfer(cpi_ctx, collateral_amount)?;

        // Require a healthy score after transactions
        let health_score = calculate_health_score(&multi_pool_comet, token_data)?;

        require!(
            match health_score {
                math::HealthScore::Healthy { score: _ } => true,
                math::HealthScore::SubjectToLiquidation => false,
            },
            error::InceptError::HealthScoreTooLow
        );

        Ok(())
    }

    pub fn add_liquidity_to_multi_pool_comet(
        ctx: Context<AddLiquidityToMultiPoolComet>,
        manager_nonce: u8,
        comet_position_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;
        let multi_pool_comet_position =
            multi_pool_comet.comet_positions[comet_position_index as usize];

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
            );

        // find the index of the comet within the manager's position
        let multi_pool_comet_pool_index = multi_pool_comet
            .get_pool_index(multi_pool_comet_position.pool_index.try_into().unwrap());
        let comet_position = multi_pool_comet.comet_positions[multi_pool_comet_pool_index];

        // update comet position data
        multi_pool_comet.comet_positions[multi_pool_comet_pool_index].borrowed_usdi =
            comet_position
                .borrowed_usdi
                .add(usdi_liquidity_value)
                .unwrap();
        multi_pool_comet.comet_positions[multi_pool_comet_pool_index].borrowed_iasset =
            comet_position
                .borrowed_iasset
                .add(iasset_liquidity_value)
                .unwrap();
        multi_pool_comet.comet_positions[multi_pool_comet_pool_index].liquidity_token_value =
            comet_position
                .liquidity_token_value
                .add(liquidity_token_value)
                .unwrap();

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

        // Require a healthy score after transactions
        let health_score = calculate_health_score(&multi_pool_comet, token_data)?;

        require!(
            match health_score {
                math::HealthScore::Healthy { score: _ } => true,
                math::HealthScore::SubjectToLiquidation => false,
            },
            error::InceptError::HealthScoreTooLow
        );

        Ok(())
    }

    pub fn withdraw_liquidity_from_multi_pool_comet(
        ctx: Context<WithdrawLiquidityFromMultiPoolComet>,
        manager_nonce: u8,
        pool_index: u8,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;

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
            );

        // find the index of the comet within the manager's position
        let multi_pool_comet_pool_index = multi_pool_comet.get_pool_index(pool_index);
        let comet_position = multi_pool_comet.comet_positions[multi_pool_comet_pool_index];

        // update comet position data
        multi_pool_comet.comet_positions[multi_pool_comet_pool_index].borrowed_usdi =
            comet_position
                .borrowed_usdi
                .sub(usdi_liquidity_value)
                .unwrap();
        multi_pool_comet.comet_positions[multi_pool_comet_pool_index].borrowed_iasset =
            comet_position
                .borrowed_iasset
                .sub(iasset_liquidity_value)
                .unwrap();
        multi_pool_comet.comet_positions[multi_pool_comet_pool_index].liquidity_token_value =
            comet_position
                .liquidity_token_value
                .sub(liquidity_token_value)
                .unwrap();

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

    pub fn recenter_multi_pool_comet(
        ctx: Context<RecenterMultiPoolComet>,
        manager_nonce: u8,
        comet_position_index: u8,
        collateral_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;
        let comet_position = multi_pool_comet.comet_positions[comet_position_index as usize];

        let multi_pool_collateral_index = multi_pool_comet.get_collateral_index(collateral_index);
        let collateral = multi_pool_comet.collaterals[multi_pool_collateral_index];

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
        );

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
            multi_pool_comet.collaterals[multi_pool_collateral_index as usize].collateral_amount =
                new_collateral_amount;
            multi_pool_comet.total_collateral_amount = multi_pool_comet
                .total_collateral_amount
                .sub(collateral_recentering_fee.scale_to(DEVNET_TOKEN_SCALE))
                .unwrap();
            multi_pool_comet.comet_positions[comet_position_index as usize].borrowed_iasset =
                new_borrowed_iasset;
            multi_pool_comet.comet_positions[comet_position_index as usize].borrowed_usdi =
                new_borrowed_usdi;

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
        } else {
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
            multi_pool_comet.comet_positions[comet_position_index as usize].borrowed_iasset =
                new_borrowed_iasset;
            multi_pool_comet.comet_positions[comet_position_index as usize].borrowed_usdi =
                new_borrowed_usdi;

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

    pub fn close_multi_pool_comet(
        ctx: Context<CloseMultiPoolComet>,
        manager_nonce: u8,
        comet_position_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut multi_pool_comet = ctx.accounts.multi_pool_comet.load_mut()?;
        let comet_position = multi_pool_comet.comet_positions[comet_position_index as usize];

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
        if comet_position.comet_liquidation.status == LiquidationStatus::Fully {
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
        );

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
        multi_pool_comet.remove_position(comet_position_index as usize);

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

    pub fn liquidate_comet(
        ctx: Context<LiquidateComet>,
        manager_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status == LiquidationStatus::Fully {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        let pool = token_data.pools[comet_position.pool_index as usize];

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

        // generate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);
        // ensure price data is up to date
        let slot = Clock::get()?.slot;
        check_feed_update(pool.asset_info, slot).unwrap();

        let lower_price_breached = current_price.lte(comet_position.lower_price_range).unwrap()
            || pool
                .asset_info
                .price
                .scale_to(comet_position.lower_price_range.scale.try_into().unwrap())
                .lte(comet_position.lower_price_range)
                .unwrap();

        let upper_price_breached = current_price.gte(comet_position.upper_price_range).unwrap()
            || pool
                .asset_info
                .price
                .scale_to(comet_position.upper_price_range.scale.try_into().unwrap())
                .gte(comet_position.upper_price_range)
                .unwrap();

        if !(lower_price_breached || upper_price_breached) {
            return Err(InceptError::CometUnableToLiquidate.into());
        }

        // calculate usdi and iasset comet can claim right now
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            comet_position.liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        );

        let pool_iasset_to_burn;
        let pool_usdi_to_burn;

        if lower_price_breached {
            // calculate usdi impermenant loss
            let usdi_impermanent_loss_value = comet_position.borrowed_usdi.sub(usdi_value).unwrap();

            // burn usdi from liquidator to pay off loss
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .liquidator_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.liquidator.to_account_info().clone(),
            };
            let burn_liquidator_usdi_context = CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
            );

            token::burn(
                burn_liquidator_usdi_context,
                usdi_impermanent_loss_value.to_u64(),
            )?;

            pool_usdi_to_burn = usdi_value;
            pool_iasset_to_burn = comet_position.borrowed_iasset;
        } else {
            // calculate iasset impermenant loss
            let iasset_impermanent_loss_value =
                comet_position.borrowed_iasset.sub(iasset_value).unwrap();

            // burn iasset from liquidator to pay off loss
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
                iasset_impermanent_loss_value.to_u64(),
            )?;

            pool_usdi_to_burn = comet_position.borrowed_usdi;
            pool_iasset_to_burn = iasset_value;
        }

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
        let burn_amm_usdi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::burn(burn_amm_usdi_context, pool_usdi_to_burn.to_u64())?;

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
        let burn_amm_iasset_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::burn(burn_amm_iasset_context, pool_iasset_to_burn.to_u64())?;

        if lower_price_breached {
            // send surplus iasset to liquidation account
            let cpi_accounts = Transfer {
                from: ctx
                    .accounts
                    .amm_iasset_token_account
                    .to_account_info()
                    .clone(),
                to: ctx
                    .accounts
                    .liquidation_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_iasset_context,
                iasset_value
                    .sub(comet_position.borrowed_iasset)
                    .unwrap()
                    .to_u64(),
            )?;
        } else if upper_price_breached {
            // send surplus usdi to liquidation account
            let cpi_accounts = Transfer {
                from: ctx
                    .accounts
                    .amm_usdi_token_account
                    .to_account_info()
                    .clone(),
                to: ctx.accounts.liquidated_comet_usdi.to_account_info().clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_iasset_context,
                usdi_value
                    .sub(comet_position.borrowed_usdi)
                    .unwrap()
                    .to_u64(),
            )?;
        }

        // send collateral to liquidator as reward (currently too much)
        // Maybe ok if we do partial liquidations...
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info().clone(),
            to: ctx
                .accounts
                .liquidator_collateral_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let send_collateral_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        token::transfer(
            send_collateral_context,
            comet_position.collateral_amount.to_u64(),
        )?;

        // update comet data
        comet_positions.comet_positions[comet_index as usize]
            .comet_liquidation
            .status = LiquidationStatus::Fully;

        if lower_price_breached {
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .excess_token_type_is_usdi = 0;
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .excess_token_amount = iasset_value.sub(comet_position.borrowed_iasset).unwrap();
        } else {
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .excess_token_type_is_usdi = 1;
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .excess_token_amount = usdi_value.sub(comet_position.borrowed_usdi).unwrap();
        }

        Ok(())
    }

    pub fn claim_liquidated_comet(
        ctx: Context<ClaimLiquidatedComet>,
        manager_nonce: u8,
        _user_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        // throw error if the comet is not yet liquidated
        if comet_position.comet_liquidation.status == LiquidationStatus::Healthy {
            return Err(InceptError::CometNotYetLiquidated.into());
        }

        if comet_position.comet_liquidation.excess_token_type_is_usdi == 0 {
            // send surplus iasset to user
            let cpi_accounts = Transfer {
                from: ctx
                    .accounts
                    .liquidation_iasset_token_account
                    .to_account_info()
                    .clone(),
                to: ctx
                    .accounts
                    .user_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_iasset_context,
                comet_position
                    .comet_liquidation
                    .excess_token_amount
                    .to_u64(),
            )?;
        } else {
            // send surplus usdi to user
            let cpi_accounts = Transfer {
                from: ctx.accounts.liquidated_comet_usdi.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let send_usdi_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::transfer(
                send_usdi_context,
                comet_position
                    .comet_liquidation
                    .excess_token_amount
                    .to_u64(),
            )?;
        }

        // remove comet from user list
        comet_positions.remove(comet_index as usize);

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

    pub fn partial_comet_liquidation(
        ctx: Context<PartialCometLiquidation>,
        manager_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

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

        // TODO: Check if a partial liquidation or full liquidation is valid.

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.status != LiquidationStatus::Healthy {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // calculate usdi and iasset comet can claim right now
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            comet_position.liquidity_token_value,
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        );

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
                .scale_to(comet_position.collateral_amount.scale.try_into().unwrap());

            // recalculate the amount of collateral claimable by the comet
            let new_collateral_amount = comet_position
                .collateral_amount
                .sub(collateral_recentering_fee)
                .unwrap();

            // recalculate amount of iasset the comet has borrowed
            let new_borrowed_iasset = comet_position.borrowed_iasset.sub(iasset_debt).unwrap();

            // recalculate amount of usdi the comet has borrowed
            let new_borrowed_usdi = comet_position.borrowed_usdi.add(usdi_surplus).unwrap();

            // calculate recentered comet range
            let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
                new_borrowed_usdi,
                new_borrowed_iasset,
                new_collateral_amount.scale_to(DEVNET_TOKEN_SCALE),
                iasset_amm_value,
                usdi_amm_value,
            );
            // throw error if the price is out of range
            // if lower_price_range.gte(current_price).unwrap()
            //     || upper_price_range.lte(current_price).unwrap()
            // {
            //     return Err(InceptError::InvalidCometCollateralRatio.into());
            // }

            // update comet data
            comet_positions.comet_positions[comet_index as usize].lower_price_range =
                lower_price_range;
            comet_positions.comet_positions[comet_index as usize].upper_price_range =
                upper_price_range;
            comet_positions.comet_positions[comet_index as usize].collateral_amount =
                new_collateral_amount;
            comet_positions.comet_positions[comet_index as usize].borrowed_iasset =
                new_borrowed_iasset;
            comet_positions.comet_positions[comet_index as usize].borrowed_usdi = new_borrowed_usdi;

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
        } else {
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

            // calculate the amount of additional iasset, otherwise known as the recentering fee, in order to recenter the position
            let collateral_recentering_fee = iasset_amount
                .sub(iasset_surplus)
                .unwrap()
                .scale_to(comet_position.collateral_amount.scale.try_into().unwrap());

            // recalculate amount of iasset the comet has borrowed
            let new_borrowed_iasset = comet_position.borrowed_iasset.add(iasset_surplus).unwrap();

            // recalculate amount of usdi the comet has borrowed
            let new_borrowed_usdi = comet_position.borrowed_usdi.sub(usdi_debt).unwrap();

            // calculate recentered comet range
            let (lower_price_range, upper_price_range) = calculate_comet_price_barrier(
                new_borrowed_usdi,
                new_borrowed_iasset,
                comet_position
                    .collateral_amount
                    .scale_to(DEVNET_TOKEN_SCALE),
                iasset_amm_value,
                usdi_amm_value,
            );
            // throw error if the price is out of range
            // if lower_price_range.gte(current_price).unwrap()
            //     || upper_price_range.lte(current_price).unwrap()
            // {
            //     return Err(InceptError::InvalidCometCollateralRatio.into());
            // }
            // update comet data
            comet_positions.comet_positions[comet_index as usize].lower_price_range =
                lower_price_range;
            comet_positions.comet_positions[comet_index as usize].upper_price_range =
                upper_price_range;
            comet_positions.comet_positions[comet_index as usize].borrowed_iasset =
                new_borrowed_iasset;
            comet_positions.comet_positions[comet_index as usize].borrowed_usdi = new_borrowed_usdi;

            // burn iasset from liquidator
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .user_iasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.liquidator.to_account_info().clone(),
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
        }

        Ok(())
    }
}
