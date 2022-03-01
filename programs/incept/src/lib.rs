use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Transfer};
use error::*;
use instructions::*;
use pyth::pc::Price;
use states::{
    AssetInfo, Collateral, CometLiquidation, CometPosition, LiquidityPosition,
    MintPosition, Pool, TokenData, Value,
};

mod error;
mod instructions;
mod math;
mod states;
mod value;

declare_id!("Aw4gPAFKNV9hQpSZB9pdkBnniVDR13uidY3D5NMKKFUi");

#[program]
pub mod incept {
    use std::convert::TryInto;

    use crate::math::*;
    use crate::value::{Add, Compare, Mul, Sub, DEVNET_TOKEN_SCALE};

    use super::*;

    pub fn initialize_manager(
        ctx: Context<InitializeManager>,
        _manager_nonce: u8,
    ) -> ProgramResult {
        let mut token_data = ctx.accounts.token_data.load_init()?;

        // set manager data
        ctx.accounts.manager.token_data = *ctx.accounts.token_data.to_account_info().key;
        ctx.accounts.manager.usdi_mint = *ctx.accounts.usdi_mint.to_account_info().key;
        ctx.accounts.manager.liquidated_comet_usdi = *ctx
            .accounts
            .liquidated_comet_usdi_token_account
            .to_account_info()
            .key;

        // set manager as token data owner
        token_data.manager = *ctx.accounts.manager.to_account_info().key;

        Ok(())
    }

    pub fn initialize_user(
        ctx: Context<InitializeUser>,
        _manager_nonce: u8,
        _user_nonce: u8,
    ) -> ProgramResult {
        let mut comet_positions = ctx.accounts.comet_positions.load_init()?;
        let mut mint_positions = ctx.accounts.mint_positions.load_init()?;
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_init()?;

        // set user data
        ctx.accounts.user_account.authority = *ctx.accounts.user.to_account_info().key;
        ctx.accounts.user_account.comet_positions =
            *ctx.accounts.comet_positions.to_account_info().key;
        ctx.accounts.user_account.mint_positions =
            *ctx.accounts.mint_positions.to_account_info().key;
        ctx.accounts.user_account.liquidity_positions =
            *ctx.accounts.liquidity_positions.to_account_info().key;

        // set user as comet, mint, and liquidity positions owner
        comet_positions.owner = *ctx.accounts.user.to_account_info().key;
        mint_positions.owner = *ctx.accounts.user.to_account_info().key;
        liquidity_positions.owner = *ctx.accounts.user.to_account_info().key;

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
                *ctx.remaining_accounts[0].to_account_info().key,
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
            stable: stable,
        });

        Ok(())
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        _manager_nonce: u8,
        stable_collateral_ratio: u16,
        crypto_collateral_ratio: u16,
    ) -> ProgramResult {
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
            asset_info: AssetInfo {
                ..Default::default()
            },
        });
        let index = token_data.num_pools - 1;
        token_data.pools[index as usize].asset_info.iasset_mint =
            *ctx.accounts.iasset_mint.to_account_info().key;
        token_data.pools[index as usize]
            .asset_info
            .price_feed_address = *ctx.accounts.oracle.to_account_info().key;
        token_data.pools[0].asset_info.stable_collateral_ratio =
            Value::from_percent(stable_collateral_ratio);
        token_data.pools[0].asset_info.crypto_collateral_ratio =
            Value::from_percent(crypto_collateral_ratio);

        Ok(())
    }

    pub fn update_prices(ctx: Context<UpdatePrices>, _manager_nonce: u8) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        // loop through each oracle entered into the instrction
        for oracle_account in ctx.remaining_accounts {
            // generate data from oracle
            let price_feed = Price::load(oracle_account)?;
            let expo_u8: u8 = price_feed.expo.abs().try_into().unwrap();
            let (_, pool_index) = TokenData::get_pool_tuple_from_oracle(
                token_data,
                *oracle_account.to_account_info().key,
            )
            .unwrap();
            let price = Value::new(price_feed.agg.price.try_into().unwrap(), expo_u8);
            let confidence = Value::new(price_feed.agg.conf.try_into().unwrap(), expo_u8);
            // ensure prices have proper confidence
            check_price_confidence(price, confidence).unwrap();

            // update price data
            token_data.pools[pool_index].asset_info.price = price;
            token_data.pools[pool_index].asset_info.twap =
                Value::new(price_feed.twap.try_into().unwrap(), expo_u8);
            token_data.pools[pool_index].asset_info.confidence =
                Value::new(price_feed.agg.conf.try_into().unwrap(), expo_u8);
            token_data.pools[pool_index].asset_info.status = price_feed.agg.status.into();
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
            collateral_scale,
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
            .scale_to(collateral_scale)
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
            usdi_value.scale_to(collateral_scale).to_u64(),
        )?;

        // mint usdi to user
        let cpi_ctx_mint: CpiContext<MintTo> = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(cpi_ctx_mint, amount)?;

        Ok(())
    }

    pub fn initialize_mint_position(
        ctx: Context<InitializeMintPosition>,
        manager_nonce: u8,
        _user_nonce: u8,
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

        let collateral_amount_value =
            Value::new(collateral_amount.into(), collateral.vault_mint_supply.scale);
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
        )
        .unwrap();

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
        _user_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;

        let collateral = token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize];
        let mint_position = mint_positions.mint_positions[mint_index as usize];

        let amount_value = Value::new(amount.into(), collateral.vault_mint_supply.scale);

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
        _user_nonce: u8,
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

        let amount_value = Value::new(amount.into(), collateral.vault_mint_supply.scale);

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
        _user_nonce: u8,
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
        _user_nonce: u8,
        mint_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let token_data = &mut ctx.accounts.token_data.load_mut()?;
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

        let token_data = ctx.accounts.token_data.load()?;

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
            pool_index: pool_index,
        };
        liquidity_positions.num_positions += 1;

        Ok(())
    }

    pub fn provide_liquidity(
        ctx: Context<ProvideLiquidity>,
        manager_nonce: u8,
        liquidity_position_index: u8,
        iasset_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

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

        Ok(())
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        manager_nonce: u8,
        liquidity_position_index: u8,
        liquidity_token_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

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

        Ok(())
    }

    pub fn buy_synth(
        ctx: Context<BuySynth>,
        manager_nonce: u8,
        _pool_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

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

        Ok(())
    }

    pub fn sell_synth(
        ctx: Context<SellSynth>,
        manager_nonce: u8,
        _pool_index: u8,
        amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

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

        Ok(())
    }

    pub fn initialize_comet(
        ctx: Context<InitializeComet>,
        manager_nonce: u8,
        _user_nonce: u8,
        pool_index: u8,
        collateral_amount: u64,
        usdi_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let (collateral, collateral_index) =
            TokenData::get_collateral_tuple(token_data, *ctx.accounts.vault.to_account_info().key)
                .unwrap();

        let collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale,
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
            liquidity_token_value,
            liquidity_token_supply,
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
            pool_index: pool_index,
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

        Ok(())
    }

    pub fn add_collateral_to_comet(
        ctx: Context<AddCollateralToComet>,
        _manager_nonce: u8,
        _user_nonce: u8,
        comet_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];

        let collateral = token_data.collaterals[comet_position.collateral_index as usize];

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.liquidated {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        let added_collateral_value = Value::new(
            collateral_amount.into(),
            collateral.vault_comet_supply.scale,
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

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
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
            comet_position.liquidity_token_value,
            liquidity_token_supply,
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
        _user_nonce: u8,
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
            collateral.vault_comet_supply.scale,
        );

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.liquidated {
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

        let liquidity_token_supply = Value::new(
            ctx.accounts.liquidity_token_mint.supply.into(),
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
            comet_position.liquidity_token_value,
            liquidity_token_supply,
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

    pub fn close_comet(
        ctx: Context<CloseComet>,
        manager_nonce: u8,
        _user_nonce: u8,
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
        if comet_position.comet_liquidation.liquidated {
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

        Ok(())
    }

    pub fn recenter_comet(
        ctx: Context<RecenterComet>,
        manager_nonce: u8,
        _user_nonce: u8,
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

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.liquidated {
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
                .scale_to(comet_position.collateral_amount.scale);

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
                comet_position.liquidity_token_value,
                liquidity_token_supply,
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
                .scale_to(comet_position.collateral_amount.scale);

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
                comet_position.liquidity_token_value,
                liquidity_token_supply,
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

        Ok(())
    }

    pub fn liquidate_comet(
        ctx: Context<LiquidateComet>,
        manager_nonce: u8,
        _user_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load()?;

        let mut comet_positions = ctx.accounts.comet_positions.load_mut()?;
        let comet_position = comet_positions.comet_positions[comet_index as usize];
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

        // throw error if the comet is already liquidated
        if comet_position.comet_liquidation.liquidated {
            return Err(InceptError::CometAlreadyLiquidated.into());
        }

        // generate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // ensure price data is up to date
        let slot = Clock::get()?.slot;
        check_feed_update(pool.asset_info, slot).unwrap();

        // check to see if comet price is below price range
        if comet_position.lower_price_range.gte(current_price).unwrap()
            || comet_position
                .lower_price_range
                .gte(pool.asset_info.price)
                .unwrap()
        {
            // calculate usdi and iasset comet can claim right now
            let (iasset_value, usdi_value) =
                calculate_liquidity_provider_values_from_liquidity_tokens(
                    comet_position.liquidity_token_value,
                    iasset_amm_value,
                    usdi_amm_value,
                    liquidity_token_supply,
                );

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

            token::burn(burn_amm_usdi_context, usdi_value.to_u64())?;

            // burn iasset from amm
            let cpi_accounts = Burn {
                mint: ctx.accounts.iasset_mint.to_account_info().clone(),
                to: ctx
                    .accounts
                    .amm_usdi_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_amm_iasset_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );

            token::burn(
                burn_amm_iasset_context,
                comet_position.borrowed_iasset.to_u64(),
            )?;

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

            // send collateral to liquidator as reward (currently too much)
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

            token::transfer(send_usdc_context, comet_position.collateral_amount.to_u64())?;

            // update comet data
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .liquidated = true;
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .excess_token_type_is_usdi = false;
            comet_positions.comet_positions[comet_index as usize]
                .comet_liquidation
                .excess_token_amount = iasset_value.sub(comet_position.borrowed_iasset).unwrap();
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
        if !comet_position.comet_liquidation.liquidated {
            return Err(InceptError::CometNotYetLiquidated.into());
        }

        if comet_position.comet_liquidation.excess_token_type_is_usdi {
            // need to be able to liquidate when above range
        } else {
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
        }

        // remove comet from user list
        comet_positions.remove(comet_index as usize);

        Ok(())
    }
}
