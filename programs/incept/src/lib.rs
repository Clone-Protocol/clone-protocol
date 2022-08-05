use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use anchor_spl::token::{self, Burn, MintTo, Transfer};
use chainlink_solana as chainlink;
use error::*;
use instructions::*;
use pyth::pc::Price;
use rust_decimal::prelude::*;
use states::{
    AssetInfo, Collateral, CometCollateral, CometLiquidation, CometPosition, LiquidityPosition,
    MintPosition, Pool, RawDecimal, TokenData, Value, DEVNET_TOKEN_SCALE,
};

mod error;
mod instructions;
mod math;
mod states;
mod value;

const USDI_COLLATERAL_INDEX: usize = 0;

declare_id!("3j5wcCkkjns9wibgXVNAay3gzjZiVvYUbW66vqvjEaS7");

#[program]
pub mod incept {
    use std::convert::TryInto;

    use math::calculate_invariant;

    use crate::math::*;

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

        // add usdi as first collateral type
        token_data.append_collateral(Collateral {
            pool_index: u8::MAX.into(),
            mint: *ctx.accounts.usdi_mint.to_account_info().key,
            vault: *ctx.accounts.usdi_vault.to_account_info().key,
            vault_usdi_supply: RawDecimal::new(0, DEVNET_TOKEN_SCALE),
            vault_mint_supply: RawDecimal::new(0, DEVNET_TOKEN_SCALE),
            vault_comet_supply: RawDecimal::new(0, DEVNET_TOKEN_SCALE),
            collateralization_ratio: RawDecimal::from(Decimal::one()),
            stable: 1,
        });
        token_data.num_collaterals = 1;

        // set token data
        token_data.manager = *ctx.accounts.manager.to_account_info().key;
        token_data.chainlink_program = *ctx.accounts.chainlink_program.to_account_info().key;
        token_data.il_health_score_coefficient = RawDecimal::new(
            _il_health_score_coefficient.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.il_health_score_cutoff = RawDecimal::new(
            _il_health_score_cutoff.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.il_liquidation_reward_pct = RawDecimal::new(
            _il_liquidation_reward_pct.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

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
        token_data.il_health_score_coefficient = RawDecimal::new(
            _il_health_score_coefficient.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

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
        collateralization_ratio: u64,
    ) -> ProgramResult {
        require!(
            if stable == 0 {
                collateralization_ratio > 0
            } else {
                true
            },
            InceptError::NonZeroCollateralizationRatioRequired
        );

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
            vault_usdi_supply: RawDecimal::new(0, scale.into()),
            vault_mint_supply: RawDecimal::new(0, scale.into()),
            vault_comet_supply: RawDecimal::new(0, scale.into()),
            stable: stable as u64,
            collateralization_ratio: RawDecimal::new(
                collateralization_ratio.try_into().unwrap(),
                DEVNET_TOKEN_SCALE,
            ),
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
            iasset_amount: RawDecimal::default(),
            usdi_amount: RawDecimal::default(),
            liquidity_token_supply: RawDecimal::default(),
            treasury_trading_fee: RawDecimal::from_percent(0),
            liquidity_trading_fee: RawDecimal::from_percent(liquidity_trading_fee),
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
            .stable_collateral_ratio = RawDecimal::from_percent(stable_collateral_ratio);
        token_data.pools[index as usize]
            .asset_info
            .crypto_collateral_ratio = RawDecimal::from_percent(crypto_collateral_ratio);
        token_data.pools[index as usize]
            .asset_info
            .health_score_coefficient = RawDecimal::new(
            health_score_coefficient.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

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
            .health_score_coefficient = RawDecimal::new(
            health_score_coefficient.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

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
            let pyth_price = Decimal::new(price_feed.agg.price.try_into().unwrap(), expo_u8.into());
            // ensure prices have proper confidence, TODO: Not sure if this is needed https://docs.pyth.network/consume-data/best-practices
            // let confidence = Decimal::new(price_feed.agg.conf.try_into().unwrap(), expo_u8.into());
            // check_price_confidence(pyth_price, confidence)?;

            // Generate data from Chainlink oracle
            let round = chainlink::latest_round_data(
                chainlink_program.to_account_info(),
                chainlink_oracle.to_account_info(),
            )?;

            let decimals = chainlink::decimals(
                chainlink_program.to_account_info(),
                chainlink_oracle.to_account_info(),
            )?;

            let chainlink_price = Decimal::new(round.answer.try_into().unwrap(), decimals.into());

            // take an average to use as the oracle price.
            let mut average_price = (chainlink_price + pyth_price) / Decimal::new(2, 0);
            average_price.rescale(DEVNET_TOKEN_SCALE);

            // update price data
            token_data.pools[pool_index].asset_info.price = RawDecimal::from(average_price);
            token_data.pools[pool_index].asset_info.twap =
                RawDecimal::new(price_feed.twap.try_into().unwrap(), expo_u8.into());
            token_data.pools[pool_index].asset_info.confidence =
                RawDecimal::new(price_feed.agg.conf.try_into().unwrap(), expo_u8.into());
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
        let collateral_scale = collateral.vault_mint_supply.to_decimal().scale();

        let mut usdi_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

        let collateral_value = Decimal::from_str(
            &ctx.accounts
                .user_collateral_token_account
                .amount
                .to_string(),
        )
        .unwrap()
            / Decimal::new(1, collateral_scale.try_into().unwrap());

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
        if usdi_value > collateral_value {
            return Err(InceptError::InsufficientCollateral.into());
        }

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index].vault_usdi_supply =
            RawDecimal::from(collateral.vault_usdi_supply.to_decimal() + collateral_value);

        // transfer user collateral to vault
        usdi_value.rescale(collateral_scale.try_into().unwrap());
        let cpi_ctx_transfer: CpiContext<Transfer> = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx_transfer, usdi_value.mantissa().try_into().unwrap())?;

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

        let collateral_amount_value = Decimal::new(
            collateral_amount.try_into().unwrap(),
            collateral
                .vault_mint_supply
                .to_decimal()
                .scale()
                .try_into()
                .unwrap(),
        );
        let iasset_amount_value =
            Decimal::new(iasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

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
        let collateral_ratio = pool.asset_info.stable_collateral_ratio.to_decimal();

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
            collateral_amount: RawDecimal::from(collateral_amount_value),
            collateral_index: collateral_index.try_into().unwrap(),
            pool_index: pool_index.try_into().unwrap(),
            borrowed_iasset: RawDecimal::from(iasset_amount_value),
        };

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index].vault_mint_supply =
            RawDecimal::from(collateral.vault_mint_supply.to_decimal() + collateral_amount_value);

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

        let amount_value = Decimal::new(
            amount.try_into().unwrap(),
            collateral
                .vault_mint_supply
                .to_decimal()
                .scale()
                .try_into()
                .unwrap(),
        );

        // add collateral amount to vault supply
        token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
            .vault_mint_supply =
            RawDecimal::from(collateral.vault_mint_supply.to_decimal() + amount_value);

        // add collateral amount to mint data
        mint_positions.mint_positions[mint_index as usize].collateral_amount =
            RawDecimal::from(mint_position.collateral_amount.to_decimal() + amount_value);

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

        let amount_value = Decimal::new(
            amount.try_into().unwrap(),
            collateral
                .vault_mint_supply
                .to_decimal()
                .scale()
                .try_into()
                .unwrap(),
        );

        // subtract collateral amount from vault supply
        token_data.collaterals
            [mint_positions.mint_positions[mint_index as usize].collateral_index as usize]
            .vault_mint_supply =
            RawDecimal::from(collateral.vault_mint_supply.to_decimal() - amount_value);

        // subtract collateral amount from mint data
        mint_positions.mint_positions[mint_index as usize].collateral_amount =
            RawDecimal::from(mint_position.collateral_amount.to_decimal() - amount_value);
        let slot = Clock::get()?.slot;

        // ensure position sufficiently over collateralized and oracle prices are up to date
        check_mint_collateral_sufficient(
            pool.asset_info,
            mint_position.borrowed_iasset.to_decimal(),
            collateral_ratio.to_decimal(),
            mint_positions.mint_positions[mint_index as usize]
                .collateral_amount
                .to_decimal(),
            slot,
        )
        .unwrap();

        // send collateral back to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::transfer(cpi_ctx, amount)?;

        // check to see if mint is empty, if so remove
        if mint_positions.mint_positions[mint_index as usize]
            .collateral_amount
            .to_decimal()
            .is_zero()
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
        let amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

        let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;
        let mint_position = mint_positions.mint_positions[mint_index as usize];

        // burn user iasset to pay back mint position
        let cpi_ctx_burn: CpiContext<Burn> = CpiContext::from(&*ctx.accounts);
        token::burn(cpi_ctx_burn, amount)?;

        // update total amount of borrowed iasset
        let updated_borrowed_iasset = mint_position.borrowed_iasset.to_decimal() - amount_value;
        mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
            RawDecimal::from(updated_borrowed_iasset);

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

        let amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

        let pool_index = mint_positions.mint_positions[mint_index as usize].pool_index;
        let pool = token_data.pools[pool_index as usize];
        let mint_position = mint_positions.mint_positions[mint_index as usize];
        let collateral_ratio = pool.asset_info.stable_collateral_ratio.to_decimal();

        // update total amount of borrowed iasset
        mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
            RawDecimal::from(mint_position.borrowed_iasset.to_decimal() + amount_value);

        let slot = Clock::get()?.slot;

        // ensure position sufficiently over collateralized and oracle prices are up to date
        check_mint_collateral_sufficient(
            pool.asset_info,
            mint_positions.mint_positions[mint_index as usize]
                .borrowed_iasset
                .to_decimal(),
            collateral_ratio,
            mint_position.collateral_amount.to_decimal(),
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

        let iasset_liquidity_value =
            Decimal::new(iasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

        // calculate amount of usdi required as well as amount of liquidity tokens to be received
        let (mut usdi_liquidity_value, mut liquidity_token_value) =
            calculate_liquidity_provider_values_from_iasset(
                iasset_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        // check to see if the pool is currently empty
        if iasset_amm_value.mantissa() == 0 && usdi_amm_value.mantissa() == 0 {
            let price = token_data.pools[pool_index as usize]
                .asset_info
                .price
                .to_decimal();
            usdi_liquidity_value *= price;
            liquidity_token_value *= price;
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
        usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);

        token::transfer(
            send_usdi_to_amm_context,
            usdi_liquidity_value.mantissa().try_into().unwrap(),
        )?;

        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

        // mint liquidity tokens to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(
            cpi_ctx,
            liquidity_token_value.mantissa().try_into().unwrap(),
        )?;

        // set liquidity position data
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
        let num_positions = liquidity_positions.num_positions;
        liquidity_positions.liquidity_positions[num_positions as usize] = LiquidityPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            liquidity_token_value: RawDecimal::from(liquidity_token_value),
            pool_index: pool_index.try_into().unwrap(),
        };
        liquidity_positions.num_positions += 1;

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

        let iasset_liquidity_value =
            Decimal::new(iasset_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

        // calculate amount of usdi required as well as amount of liquidity tokens to be received
        let (mut usdi_liquidity_value, mut liquidity_token_value) =
            calculate_liquidity_provider_values_from_iasset(
                iasset_liquidity_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

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

        token::transfer(
            send_usdi_to_amm_context,
            usdi_liquidity_value.mantissa().try_into().unwrap(),
        )?;

        // mint liquidity tokens to user
        let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
        token::mint_to(
            cpi_ctx,
            liquidity_token_value.mantissa().try_into().unwrap(),
        )?;

        // update liquidity position data
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
        let liquidity_position =
            liquidity_positions.liquidity_positions[liquidity_position_index as usize];
        liquidity_positions.liquidity_positions[liquidity_position_index as usize]
            .liquidity_token_value = RawDecimal::from(
            liquidity_position.liquidity_token_value.to_decimal() + liquidity_token_value,
        );

        // update pool data
        ctx.accounts.amm_iasset_token_account.reload()?;
        ctx.accounts.amm_usdi_token_account.reload()?;
        ctx.accounts.liquidity_token_mint.reload()?;

        token_data.pools[liquidity_position.pool_index as usize].iasset_amount = RawDecimal::new(
            ctx.accounts
                .amm_iasset_token_account
                .amount
                .try_into()
                .unwrap(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].usdi_amount = RawDecimal::new(
            ctx.accounts
                .amm_usdi_token_account
                .amount
                .try_into()
                .unwrap(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].liquidity_token_supply =
            RawDecimal::new(
                ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
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

        let liquidity_token_value = Decimal::new(
            liquidity_token_amount.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );
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

        // calculate the amount of iasset and usdi that the user can withdraw
        let (mut iasset_value, mut usdi_value) =
            calculate_liquidity_provider_values_from_liquidity_tokens(
                liquidity_token_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        iasset_value.rescale(DEVNET_TOKEN_SCALE);
        usdi_value.rescale(DEVNET_TOKEN_SCALE);

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

        token::transfer(
            send_usdi_to_user_context,
            usdi_value.mantissa().try_into().unwrap(),
        )?;

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

        token::transfer(
            send_iasset_to_user_context,
            iasset_value.mantissa().try_into().unwrap(),
        )?;

        // update liquidity position data
        let mut liquidity_positions = ctx.accounts.liquidity_positions.load_mut()?;
        let liquidity_position =
            liquidity_positions.liquidity_positions[liquidity_position_index as usize];
        liquidity_positions.liquidity_positions[liquidity_position_index as usize]
            .liquidity_token_value = RawDecimal::from(
            liquidity_position.liquidity_token_value.to_decimal() - liquidity_token_value,
        );

        if liquidity_positions.liquidity_positions[liquidity_position_index as usize]
            .liquidity_token_value
            .to_decimal()
            .mantissa()
            == 0
        {
            // remove liquidity position from user list
            liquidity_positions.remove(liquidity_position_index as usize);
        }

        // update pool data
        ctx.accounts.amm_iasset_token_account.reload()?;
        ctx.accounts.amm_usdi_token_account.reload()?;
        ctx.accounts.liquidity_token_mint.reload()?;

        token_data.pools[liquidity_position.pool_index as usize].iasset_amount = RawDecimal::new(
            ctx.accounts
                .amm_iasset_token_account
                .amount
                .try_into()
                .unwrap(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].usdi_amount = RawDecimal::new(
            ctx.accounts
                .amm_usdi_token_account
                .amount
                .try_into()
                .unwrap(),
            DEVNET_TOKEN_SCALE,
        );
        token_data.pools[liquidity_position.pool_index as usize].liquidity_token_supply =
            RawDecimal::new(
                ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
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

        let iasset_amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

        // calculate how much usdi must be spent
        let mut usdi_amount_value = calculate_price_from_iasset(
            iasset_amount_value,
            iasset_amm_value,
            usdi_amm_value,
            true,
        )?;

        usdi_amount_value.rescale(DEVNET_TOKEN_SCALE);

        // ensure that the user has sufficient usdi
        if ctx.accounts.user_usdi_token_account.amount
            < usdi_amount_value.mantissa().try_into().unwrap()
        {
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

        token::transfer(
            send_usdi_to_amm_context,
            usdi_amount_value.mantissa().try_into().unwrap(),
        )?;

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

        let mut iasset_amount_value =
            iasset_amount_value - iasset_amount_value * pool.liquidity_trading_fee.to_decimal();

        iasset_amount_value.rescale(DEVNET_TOKEN_SCALE);

        token::transfer(
            send_iasset_to_user_context,
            iasset_amount_value.mantissa().try_into().unwrap(),
        )?;

        // update pool data
        ctx.accounts.amm_iasset_token_account.reload()?;
        ctx.accounts.amm_usdi_token_account.reload()?;
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

        let iasset_amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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

        // calculate how much usdi will be recieved
        let mut usdi_amount_value = calculate_price_from_iasset(
            iasset_amount_value,
            iasset_amm_value,
            usdi_amm_value,
            false,
        )? * (Decimal::ONE - pool.liquidity_trading_fee.to_decimal());

        usdi_amount_value.rescale(DEVNET_TOKEN_SCALE);

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

        token::transfer(
            send_usdi_to_user_context,
            usdi_amount_value.mantissa().try_into().unwrap(),
        )?;

        // update pool data
        ctx.accounts.amm_iasset_token_account.reload()?;
        ctx.accounts.amm_usdi_token_account.reload()?;
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

        Ok(())
    }

    pub fn initialize_single_pool_comet(
        ctx: Context<InitializeSinglePoolComet>,
        _manager_nonce: u8,
        pool_index: u8,
    ) -> ProgramResult {
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

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
            collateral_amount: RawDecimal::default(),
            collateral_index: collateral_index as u64,
        });
        single_pool_comet.add_position(CometPosition {
            authority: *ctx.accounts.user.to_account_info().key,
            pool_index: pool_index as u64,
            borrowed_usdi: RawDecimal::default(),
            borrowed_iasset: RawDecimal::default(),
            liquidity_token_value: RawDecimal::default(),
            comet_liquidation: CometLiquidation {
                ..Default::default()
            },
        });

        Ok(())
    }

    pub fn close_single_pool_comet(
        ctx: Context<CloseSinglePoolComet>,
        _user_nonce: u8,
        comet_index: u8,
    ) -> ProgramResult {
        // remove single pool comet
        ctx.accounts
            .single_pool_comets
            .load_mut()?
            .remove(comet_index as usize);

        let close = ctx.accounts.single_pool_comets.load_mut()?.num_comets == 0;

        // close single pool comet account
        ctx.accounts
            .single_pool_comet
            .close(ctx.accounts.user.to_account_info())?;

        // check to see if single pool comets account should be closed
        if close {
            // close single pool comets account if no comets remain
            ctx.accounts.user_account.single_pool_comets = Pubkey::default();
            ctx.accounts
                .single_pool_comets
                .close(ctx.accounts.user.to_account_info())?;
        }

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
        ctx.accounts.user_account.comet_manager.comet =
            *ctx.accounts.comet_manager.to_account_info().key;
        ctx.accounts
            .user_account
            .comet_manager
            .membership_token_mint = *ctx.accounts.membership_token_mint.to_account_info().key;

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

        let added_collateral_value = Decimal::new(
            collateral_amount.try_into().unwrap(),
            collateral
                .vault_comet_supply
                .to_decimal()
                .scale()
                .try_into()
                .unwrap(),
        );

        // add collateral amount to vault supply
        token_data.collaterals[collateral_index as usize].vault_comet_supply =
            RawDecimal::from(collateral.vault_comet_supply.to_decimal() + added_collateral_value);

        let mut total_collateral_amount =
            comet.total_collateral_amount.to_decimal() + added_collateral_value;
        total_collateral_amount.rescale(DEVNET_TOKEN_SCALE);

        // add collateral amount to total comet collateral amount
        comet.total_collateral_amount = RawDecimal::from(total_collateral_amount);

        // find the comet collateral index
        let comet_collateral_index = comet.get_collateral_index(collateral_index);

        // check to see if a new collateral must be added to the position
        if comet_collateral_index == usize::MAX {
            if comet.is_single_pool == 1 {
                return Err(InceptError::AttemptedToAddNewCollateralToSingleComet.into());
            }
            comet.add_collateral(CometCollateral {
                authority: *ctx.accounts.user.to_account_info().key,
                collateral_amount: RawDecimal::from(added_collateral_value),
                collateral_index: collateral_index.into(),
            });
        } else {
            comet.collaterals[comet_collateral_index].collateral_amount = RawDecimal::from(
                comet.collaterals[comet_collateral_index]
                    .collateral_amount
                    .to_decimal()
                    + added_collateral_value,
            );
        }

        // send collateral from user to vault
        let cpi_ctx = CpiContext::from(&*ctx.accounts);
        token::transfer(cpi_ctx, collateral_amount)?;

        Ok(())
    }

    pub fn withdraw_collateral_from_comet(
        ctx: Context<WithdrawCollateralFromComet>,
        manager_nonce: u8,
        _user_nonce: u8,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;

        let mut close = false;
        {
            let mut comet = ctx.accounts.comet.load_mut()?;
            let comet_collateral = comet.collaterals[comet_collateral_index as usize];
            let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

            let subtracted_collateral_value = Decimal::new(
                collateral_amount.try_into().unwrap(),
                collateral
                    .vault_comet_supply
                    .to_decimal()
                    .scale()
                    .try_into()
                    .unwrap(),
            );

            // subtract collateral amount from vault supply
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(
                    collateral.vault_comet_supply.to_decimal() - subtracted_collateral_value,
                );

            // TODO: Will likely just remove the total collateral amount value when we switch to non-stables.
            // subtract collateral amount from total collateral amount
            comet.total_collateral_amount = RawDecimal::from(
                comet.total_collateral_amount.to_decimal() - subtracted_collateral_value,
            );

            // ensure the position holds sufficient collateral
            if comet_collateral.collateral_amount.to_decimal() < subtracted_collateral_value {
                return Err(InceptError::InsufficientCollateral.into());
            }

            // update the collateral amount
            comet.collaterals[comet_collateral_index as usize].collateral_amount = RawDecimal::from(
                comet_collateral.collateral_amount.to_decimal() - subtracted_collateral_value,
            );

            // remove collateral if empty
            if comet.collaterals[comet_collateral_index as usize]
                .collateral_amount
                .to_decimal()
                .mantissa()
                == 0
            {
                comet.remove_collateral(comet_collateral_index as usize)
            }

            // send collateral from vault to user
            let cpi_ctx = CpiContext::from(&*ctx.accounts).with_signer(seeds);
            token::transfer(cpi_ctx, collateral_amount)?;

            // check to see if the comet is empty and should be closed
            if comet.num_collaterals == 0 {
                close = true;
            } else {
                // Require a healthy score after transactions
                let health_score = calculate_health_score(&comet, token_data)?;

                require!(
                    matches!(health_score, math::HealthScore::Healthy { .. }),
                    error::InceptError::HealthScoreTooLow
                );
            }
        }
        if close {
            // close comet account if no collateral remains
            let comet_pubkey = *ctx.accounts.comet.to_account_info().key;
            ctx.accounts
                .comet
                .close(ctx.accounts.user.to_account_info())?;
            if comet_pubkey.eq(&ctx.accounts.user_account.comet) {
                ctx.accounts.user_account.comet = Pubkey::default();
            }
        }

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

        let usdi_liquidity_value =
            Decimal::new(usdi_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
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
            )?;

        // find the index of the position within the comet position
        let comet_position_index = comet.get_pool_index(pool_index);

        // check to see if a new position must be added to the position
        if comet_position_index == usize::MAX {
            if comet.is_single_pool == 1 {
                return Err(InceptError::AttemptedToAddNewPoolToSingleComet.into());
            }

            iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
            liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

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
        } else {
            let position = comet.positions[comet_position_index];
            // update comet position data
            let mut borrowed_usdi = position.borrowed_usdi.to_decimal() + usdi_liquidity_value;
            borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

            let mut borrowed_iasset =
                position.borrowed_iasset.to_decimal() + iasset_liquidity_value;
            borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

            liquidity_token_value += position.liquidity_token_value.to_decimal();
            liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

            comet.positions[comet_position_index].borrowed_usdi = RawDecimal::from(borrowed_usdi);
            comet.positions[comet_position_index].borrowed_iasset =
                RawDecimal::from(borrowed_iasset);
            comet.positions[comet_position_index].liquidity_token_value =
                RawDecimal::from(liquidity_token_value);
        }

        iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);

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
            authority: ctx.accounts.manager.to_account_info().clone(),
        };
        let mint_liquidity_tokens_to_comet_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            cpi_accounts,
            seeds,
        );

        msg!("{:?}", liquidity_token_value.scale());

        token::mint_to(
            mint_liquidity_tokens_to_comet_context,
            liquidity_token_value.mantissa().try_into().unwrap(),
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
        liquidity_token_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];
        let token_data = &mut ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_position = comet.positions[comet_position_index as usize];

        let mut liquidity_token_value = Decimal::new(
            liquidity_token_amount.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        );

        require!(
            liquidity_token_value <= comet_position.liquidity_token_value.to_decimal(),
            InceptError::InvalidTokenAccountBalance
        );

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
        let (mut iasset_liquidity_value, mut usdi_liquidity_value) =
            calculate_liquidity_provider_values_from_liquidity_tokens(
                liquidity_token_value,
                iasset_amm_value,
                usdi_amm_value,
                liquidity_token_supply,
            )?;

        let lp_position_claimable_ratio =
            liquidity_token_value / comet_position.liquidity_token_value.to_decimal();

        // calculate initial comet pool price
        let initial_comet_price = calculate_amm_price(
            comet_position.borrowed_iasset.to_decimal(),
            comet_position.borrowed_usdi.to_decimal(),
        );
        // calculate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);
        // check if price has decreased since comet was initialized
        if initial_comet_price > current_price {
            // IL is in USDi, reward in iasset
            let mut iasset_burn_value =
                lp_position_claimable_ratio * comet_position.borrowed_iasset.to_decimal();
            iasset_burn_value = if iasset_burn_value > iasset_liquidity_value {
                iasset_liquidity_value
            } else {
                iasset_burn_value
            };

            let mut iasset_surplus = iasset_liquidity_value - iasset_burn_value;

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

            usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_usdi_context,
                usdi_liquidity_value.mantissa().try_into().unwrap(),
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
            iasset_burn_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_iasset_context,
                iasset_burn_value.mantissa().try_into().unwrap(),
            )?;

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
            iasset_surplus.rescale(DEVNET_TOKEN_SCALE);
            token::transfer(
                transfer_iasset_context,
                iasset_surplus.mantissa().try_into().unwrap(),
            )?;

            let mut borrowed_usd = comet_position.borrowed_usdi.to_decimal() - usdi_liquidity_value;
            borrowed_usd.rescale(DEVNET_TOKEN_SCALE);
            let mut borrowed_iasset =
                comet_position.borrowed_iasset.to_decimal() - iasset_burn_value;
            borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
            // update comet position data
            comet.positions[comet_position_index as usize].borrowed_usdi =
                RawDecimal::from(borrowed_usd);
            comet.positions[comet_position_index as usize].borrowed_iasset =
                RawDecimal::from(borrowed_iasset);
        } else if initial_comet_price < current_price {
            let mut usdi_burn_value =
                lp_position_claimable_ratio * comet_position.borrowed_usdi.to_decimal();
            usdi_burn_value = if usdi_burn_value > usdi_liquidity_value {
                usdi_liquidity_value
            } else {
                usdi_burn_value
            };
            let mut usdi_surplus = usdi_liquidity_value - usdi_burn_value;
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
            usdi_burn_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_usdi_context,
                usdi_burn_value.mantissa().try_into().unwrap(),
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
            iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_iasset_context,
                iasset_liquidity_value.mantissa().try_into().unwrap(),
            )?;

            // transfer surplus usdi to liquidity provider
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
            usdi_surplus.rescale(DEVNET_TOKEN_SCALE);
            token::transfer(
                transfer_usdi_context,
                usdi_surplus.mantissa().try_into().unwrap(),
            )?;
            // update comet position data
            let mut borrowed_usdi = comet_position.borrowed_usdi.to_decimal() - usdi_burn_value;
            borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
            let mut borrowed_iasset =
                comet_position.borrowed_iasset.to_decimal() - iasset_liquidity_value;
            borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

            comet.positions[comet_position_index as usize].borrowed_usdi =
                RawDecimal::from(borrowed_usdi);
            comet.positions[comet_position_index as usize].borrowed_iasset =
                RawDecimal::from(borrowed_iasset);
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
            usdi_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_usdi_context,
                usdi_liquidity_value.mantissa().try_into().unwrap(),
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
            iasset_liquidity_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_iasset_context,
                iasset_liquidity_value.mantissa().try_into().unwrap(),
            )?;

            let mut borrowed_usdi =
                comet_position.borrowed_usdi.to_decimal() - usdi_liquidity_value;
            borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);

            let mut borrowed_iasset =
                comet_position.borrowed_iasset.to_decimal() - iasset_liquidity_value;
            borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);

            comet.positions[comet_position_index as usize].borrowed_usdi =
                RawDecimal::from(borrowed_usdi);
            comet.positions[comet_position_index as usize].borrowed_iasset =
                RawDecimal::from(borrowed_iasset);
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
        liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
        token::burn(
            burn_liquidity_tokens_to_comet_context,
            liquidity_token_value.mantissa().try_into().unwrap(),
        )?;

        // update comet position data
        let mut updated_liquidity_token_value =
            comet_position.liquidity_token_value.to_decimal() - liquidity_token_value;
        updated_liquidity_token_value.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].liquidity_token_value =
            RawDecimal::from(updated_liquidity_token_value);

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
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply =
            RawDecimal::new(
                ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
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
        let comet_collateral = comet.collaterals[comet_collateral_index as usize];
        let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];

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

        // calculate usdi and iasset comet can claim right now
        let (iasset_value, usdi_value) = calculate_liquidity_provider_values_from_liquidity_tokens(
            comet_position.liquidity_token_value.to_decimal(),
            iasset_amm_value,
            usdi_amm_value,
            liquidity_token_supply,
        )?;

        let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();
        let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();

        // check if the price has moved significantly
        if (iasset_value < borrowed_iasset && usdi_value < borrowed_usdi)
            || (iasset_value > borrowed_iasset && usdi_value > borrowed_usdi)
        {
            // price has NOT moved significantly throw error
            return Err(InceptError::NoPriceDeviationDetected.into());
        }

        // calculate initial comet pool price
        let initial_comet_price = calculate_amm_price(borrowed_iasset, borrowed_usdi);
        // calculate current pool price
        let current_price = calculate_amm_price(iasset_amm_value, usdi_amm_value);

        // check if price has increased since comet was initialized
        if initial_comet_price < current_price {
            // calculate extra usdi comet can claim, iasset debt that comet cannot claim, and usdi amount needed to buy iasset and cover debt
            let (usdi_surplus, mut usdi_amount, mut iasset_debt) =
                calculate_recentering_values_with_usdi_surplus(
                    borrowed_iasset,
                    borrowed_usdi,
                    iasset_amm_value,
                    usdi_amm_value,
                    comet_position.liquidity_token_value.to_decimal(),
                    liquidity_token_supply,
                );

            // calculate the amount of additional usdi, otherwise known as the recentering fee, in order to recenter the position
            let mut recentering_fee = usdi_amount - usdi_surplus;
            assert!(!recentering_fee.is_sign_negative());
            recentering_fee.rescale(DEVNET_TOKEN_SCALE);

            let mut recentering_fee_collateral_scale = recentering_fee;
            recentering_fee_collateral_scale
                .rescale(comet_collateral.collateral_amount.to_decimal().scale());

            // recalculate amount of iasset the comet has borrowed
            let mut new_borrowed_iasset = borrowed_iasset - iasset_debt;

            // recalculate amount of usdi the comet has borrowed
            let mut new_borrowed_usdi = borrowed_usdi + usdi_surplus;

            // update comet data
            new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
            comet.positions[comet_position_index as usize].borrowed_iasset =
                RawDecimal::from(new_borrowed_iasset);

            new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
            comet.positions[comet_position_index as usize].borrowed_usdi =
                RawDecimal::from(new_borrowed_usdi);

            if comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX {
                msg!("1");

                // burn usdi from vault
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx.accounts.vault.to_account_info().clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_usdi_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                token::burn(
                    burn_usdi_context,
                    recentering_fee.mantissa().try_into().unwrap(),
                )?;
                msg!("1");
            } else {
                let mut vault_usdi_supply =
                    collateral.vault_usdi_supply.to_decimal() + recentering_fee_collateral_scale;
                vault_usdi_supply.rescale(DEVNET_TOKEN_SCALE);
                token_data.collaterals[comet_collateral.collateral_index as usize]
                    .vault_usdi_supply = RawDecimal::from(vault_usdi_supply);
            }

            // subtract the collateral the user paid from the position
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(
                    collateral.vault_comet_supply.to_decimal() - recentering_fee_collateral_scale,
                );
            let mut total_collateral_amount =
                comet.total_collateral_amount.to_decimal() - recentering_fee;
            total_collateral_amount.rescale(DEVNET_TOKEN_SCALE);
            comet.total_collateral_amount = RawDecimal::from(total_collateral_amount);
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
            iasset_debt.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_iasset_context,
                iasset_debt.mantissa().try_into().unwrap(),
            )?;
        } else if initial_comet_price > current_price {
            // calculate extra iasset comet can claim, usdi debt that comet cannot claim, and iasset amount needed to buy usdi and cover debt
            let (mut iasset_surplus, mut usdi_burned, usdi_debt) =
                calculate_recentering_values_with_iasset_surplus(
                    borrowed_iasset,
                    borrowed_usdi,
                    iasset_amm_value,
                    usdi_amm_value,
                    comet_position.liquidity_token_value.to_decimal(),
                    liquidity_token_supply,
                );

            // calculate the amount of additional iassset, otherwise known as the recentering fee, in order to recenter the position
            let mut recentering_fee = usdi_debt - usdi_burned;

            assert!(!recentering_fee.is_sign_negative());

            let mut recentering_fee_collateral_scale = recentering_fee;
            recentering_fee_collateral_scale
                .rescale(comet_collateral.collateral_amount.to_decimal().scale());
            // recalculate amount of iasset the comet has borrowed
            let mut new_borrowed_iasset = borrowed_iasset + iasset_surplus;

            // recalculate amount of usdi the comet has borrowed
            let mut new_borrowed_usdi = borrowed_usdi - usdi_debt;

            // update comet data
            new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
            comet.positions[comet_position_index as usize].borrowed_iasset =
                RawDecimal::from(new_borrowed_iasset);

            new_borrowed_usdi.rescale(DEVNET_TOKEN_SCALE);
            comet.positions[comet_position_index as usize].borrowed_usdi =
                RawDecimal::from(new_borrowed_usdi);

            if comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX {
                // burn usdi from vault
                let cpi_accounts = Burn {
                    mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                    to: ctx.accounts.vault.to_account_info().clone(),
                    authority: ctx.accounts.manager.to_account_info().clone(),
                };
                let burn_usdi_context = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    cpi_accounts,
                    seeds,
                );
                recentering_fee.rescale(DEVNET_TOKEN_SCALE);
                token::burn(
                    burn_usdi_context,
                    recentering_fee.mantissa().try_into().unwrap(),
                )?;
            } else {
                let vault_usdi_supply =
                    collateral.vault_usdi_supply.to_decimal() - recentering_fee_collateral_scale;
                // add to the amount of collateral backing usdi
                token_data.collaterals[comet_collateral.collateral_index as usize]
                    .vault_usdi_supply = RawDecimal::from(vault_usdi_supply);
            }

            let mut vault_comet_supply =
                collateral.vault_comet_supply.to_decimal() - recentering_fee;
            vault_comet_supply.rescale(DEVNET_TOKEN_SCALE);
            // subtract the collateral the user paid from the position
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(vault_comet_supply);
            let mut total_collateral_amount =
                comet.total_collateral_amount.to_decimal() - recentering_fee;
            total_collateral_amount.rescale(DEVNET_TOKEN_SCALE);
            comet.total_collateral_amount = RawDecimal::from(total_collateral_amount);

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
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply =
            RawDecimal::new(
                ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
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

        let borrowed_iasset = mint_position.borrowed_iasset.to_decimal();
        let collateral_amount_value = mint_position.collateral_amount.to_decimal();

        // Should fail here.
        if check_mint_collateral_sufficient(
            pool.asset_info,
            borrowed_iasset,
            pool.asset_info.stable_collateral_ratio.to_decimal(),
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
            mint_position
                .borrowed_iasset
                .to_decimal()
                .mantissa()
                .try_into()
                .unwrap(),
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

        token::transfer(
            send_usdc_context,
            mint_position
                .collateral_amount
                .to_decimal()
                .mantissa()
                .try_into()
                .unwrap(),
        )?;

        Ok(())
    }

    pub fn liquidate_comet_position_reduction(
        ctx: Context<LiquidateCometPositionReduction>,
        manager_nonce: u8,
        _user_nonce: u8,
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
            comet_position.borrowed_usdi.to_decimal().is_sign_positive(),
            error::InceptError::NotSubjectToLiquidation
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
            error::InceptError::LiquidationAmountTooLarge
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

        let mut usdi_reduction_amount =
            lp_token_reduction * pool_usdi_amount / liquidity_token_supply;

        let mut iasset_reduction_amount =
            lp_token_reduction * pool_iasset_amount / liquidity_token_supply;

        // Calculate amounts to burn for LP tokens, usdi and iAsset
        if pool_price > init_price {
            // Price went up, IL in iAsset, burn all iasset and reward some usdi
            let usdi_position_reduction =
                lp_token_reduction / liquidity_token_value * borrowed_usdi;
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
                    to: ctx
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
                    to: ctx
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
                    to: ctx
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
        token_data.pools[comet_position.pool_index as usize].liquidity_token_supply =
            RawDecimal::new(
                ctx.accounts.liquidity_token_mint.supply.try_into().unwrap(),
                DEVNET_TOKEN_SCALE,
            );

        let position_term = (borrowed_usdi * pool.asset_info.health_score_coefficient.to_decimal()
            / comet.total_collateral_amount.to_decimal())
        .to_f64()
        .unwrap();

        let resulting_score = match health_score {
            math::HealthScore::Healthy { score } => score + position_term,
            math::HealthScore::SubjectToLiquidation { score } => score + position_term,
        };

        require!(
            resulting_score
                < token_data
                    .il_health_score_cutoff
                    .to_decimal()
                    .to_f64()
                    .unwrap(),
            error::InceptError::LiquidationAmountTooLarge
        );

        Ok(())
    }

    pub fn liquidate_comet_il_reduction(
        ctx: Context<LiquidateCometILReduction>,
        manager_nonce: u8,
        _user_nonce: u8,
        comet_collateral_usdi_index: u8,
        position_index: u8,
        il_reduction_amount: u64,
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

        // Check that all LP positions are zero, also if there are USDi LP positions.
        let mut exists_usdi_il = false;
        for i in 0..comet.num_positions {
            let position = comet.positions[i as usize];

            if !position.liquidity_token_value.to_decimal().is_zero() {
                return Err(error::InceptError::NotSubjectToILLiquidation.into());
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
            return Err(error::InceptError::NotSubjectToILLiquidation.into());
        }

        let collateral = comet.collaterals[comet_collateral_usdi_index as usize];

        if position_is_usdi_il {
            let impermanent_loss_usdi = position.borrowed_usdi.to_decimal();

            require!(
                il_reduction_amount <= impermanent_loss_usdi.mantissa().try_into().unwrap(),
                error::InceptError::LiquidationAmountTooLarge
            );

            let liquidation_value = Decimal::new(
                il_reduction_amount.try_into().unwrap(),
                impermanent_loss_usdi.scale().try_into().unwrap(),
            );
            let total_usdi_required =
                liquidation_value * token_data.il_liquidation_reward_pct.to_decimal();
            let usdi_reward = total_usdi_required - liquidation_value;

            // remove total_usdi_required from comet, comet collateral and token data
            comet.collaterals[comet_collateral_usdi_index as usize].collateral_amount =
                RawDecimal::from(collateral.collateral_amount.to_decimal() - total_usdi_required);
            comet.total_collateral_amount =
                RawDecimal::from(comet.total_collateral_amount.to_decimal() - total_usdi_required);
            token_data.collaterals[collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(
                    token_data.collaterals[collateral.collateral_index as usize]
                        .vault_comet_supply
                        .to_decimal()
                        - total_usdi_required,
                );
            // Vault usdi supply
            // Burn USDi from vault.
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        to: ctx.accounts.vault.to_account_info().clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                total_usdi_required.mantissa().try_into().unwrap(),
            )?;

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
                error::InceptError::LiquidationAmountTooLarge
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

            let mut new_collateral_amount =
                collateral.collateral_amount.to_decimal() - total_usdi_required;
            new_collateral_amount.rescale(DEVNET_TOKEN_SCALE);
            comet.collaterals[comet_collateral_usdi_index as usize].collateral_amount =
                RawDecimal::from(new_collateral_amount);

            let mut new_total_collateral =
                comet.total_collateral_amount.to_decimal() - total_usdi_required;
            new_total_collateral.rescale(DEVNET_TOKEN_SCALE);
            comet.total_collateral_amount = RawDecimal::from(new_total_collateral);

            let mut new_vault_comet_supply = token_data.collaterals
                [collateral.collateral_index as usize]
                .vault_comet_supply
                .to_decimal()
                - total_usdi_required;
            new_vault_comet_supply.rescale(DEVNET_TOKEN_SCALE);

            token_data.collaterals[collateral.collateral_index as usize].vault_comet_supply =
                RawDecimal::from(new_vault_comet_supply);

            total_usdi_required.rescale(DEVNET_TOKEN_SCALE);
            // Burn USDi from vault.
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Burn {
                        mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                        to: ctx.accounts.vault.to_account_info().clone(),
                        authority: ctx.accounts.manager.to_account_info().clone(),
                    },
                    seeds,
                ),
                total_usdi_required.mantissa().try_into().unwrap(),
            )?;

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
                        to: ctx
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

    pub fn pay_impermanent_loss_debt(
        ctx: Context<PayImpermanentLossDebt>,
        manager_nonce: u8,
        comet_position_index: u8,
        comet_collateral_index: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        let seeds = &[&[b"manager", bytemuck::bytes_of(&manager_nonce)][..]];

        let mut token_data = ctx.accounts.token_data.load_mut()?;
        let mut comet = ctx.accounts.comet.load_mut()?;
        let comet_position = comet.positions[comet_position_index as usize];
        let comet_collateral = comet.collaterals[comet_collateral_index as usize];
        let collateral = token_data.collaterals[comet_collateral.collateral_index as usize];
        let pool = token_data.pools[comet_position.pool_index as usize];

        let mut collateral_reduction_value =
            Decimal::new(collateral_amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

        let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
        let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();

        let pool_usdi = pool.usdi_amount.to_decimal();
        let pool_iasset = pool.iasset_amount.to_decimal();

        if borrowed_usdi.is_zero() && borrowed_iasset.is_zero() {
            // if there is no debt, close the position
            // TODO: Do we also need to close out the account for a single pool?
            comet.remove_position(comet_position_index.into());
            return Ok(());
        } else if borrowed_iasset.is_zero() {
            // if usdi, update collateral and reduce borrowed amount
            collateral_reduction_value = collateral_reduction_value.min(borrowed_usdi);
            comet.positions[comet_position_index as usize].borrowed_usdi =
                RawDecimal::from(borrowed_usdi - collateral_reduction_value);
        } else if borrowed_usdi.is_zero() {
            // if iAsset, calculate iAsset from usdi amount, mint usdi to amm, burn iAsset amount from pool.
            let invariant = calculate_invariant(pool_iasset, pool_usdi);
            let new_usdi_pool_amount = pool_usdi + collateral_reduction_value;
            let mut iasset_reduction_value = pool_iasset - invariant / new_usdi_pool_amount;

            // update reduction values if they are too large
            if iasset_reduction_value > borrowed_iasset {
                let new_iasset_pool_amount = pool_iasset - borrowed_iasset;
                collateral_reduction_value = pool_usdi - invariant / new_iasset_pool_amount;
                iasset_reduction_value = borrowed_iasset;
            }

            let mut new_borrowed_iasset = borrowed_iasset - iasset_reduction_value;
            new_borrowed_iasset.rescale(DEVNET_TOKEN_SCALE);
            comet.positions[comet_position_index as usize].borrowed_iasset =
                RawDecimal::from(new_borrowed_iasset);

            // mint usdi and burn iasset from the pool
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
            token::mint_to(mint_usdi_context, collateral_amount)?;
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
            iasset_reduction_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_iasset_context,
                iasset_reduction_value.mantissa().try_into().unwrap(),
            )?;
        } else {
            return Err(InceptError::LiquidityNotWithdrawn.into());
        }

        if comet_collateral.collateral_index as usize == USDI_COLLATERAL_INDEX {
            // burn usdi from vault
            let cpi_accounts = Burn {
                mint: ctx.accounts.usdi_mint.to_account_info().clone(),
                to: ctx.accounts.vault.to_account_info().clone(),
                authority: ctx.accounts.manager.to_account_info().clone(),
            };
            let burn_usdi_context = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                cpi_accounts,
                seeds,
            );
            collateral_reduction_value.rescale(DEVNET_TOKEN_SCALE);
            token::burn(
                burn_usdi_context,
                collateral_reduction_value.mantissa().try_into().unwrap(),
            )?;
        } else {
            // add to the amount of collateral backing usdi
            let mut vault_usdi_supply =
                collateral.vault_usdi_supply.to_decimal() + collateral_reduction_value;
            vault_usdi_supply.rescale(DEVNET_TOKEN_SCALE);
            token_data.collaterals[comet_collateral.collateral_index as usize].vault_usdi_supply =
                RawDecimal::from(vault_usdi_supply);
        }

        // subtract the collateral the user paid from the position and subtract from the debt
        let mut vault_comet_supply =
            collateral.vault_comet_supply.to_decimal() - collateral_reduction_value;
        vault_comet_supply.rescale(DEVNET_TOKEN_SCALE);
        token_data.collaterals[comet_collateral.collateral_index as usize].vault_comet_supply =
            RawDecimal::from(vault_comet_supply);

        let mut total_collateral_amount =
            comet.total_collateral_amount.to_decimal() - collateral_reduction_value;
        total_collateral_amount.rescale(DEVNET_TOKEN_SCALE);
        comet.total_collateral_amount = RawDecimal::from(total_collateral_amount);

        let mut comet_collateral =
            comet_collateral.collateral_amount.to_decimal() - collateral_reduction_value;
        comet_collateral.rescale(DEVNET_TOKEN_SCALE);
        comet.collaterals[comet_collateral_index as usize].collateral_amount =
            RawDecimal::from(comet_collateral);
        if comet.positions[comet_position_index as usize]
            .borrowed_iasset
            .to_decimal()
            .is_zero()
            && comet.positions[comet_position_index as usize]
                .borrowed_usdi
                .to_decimal()
                .is_zero()
        {
            // if there is no debt, close the position
            comet.remove_position(comet_position_index.into());
        }

        // Update pool data
        ctx.accounts.amm_iasset_token_account.reload()?;
        ctx.accounts.amm_usdi_token_account.reload()?;

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

        Ok(())
    }
}
