use anchor_lang::{AccountDeserialize, AnchorSerialize, Discriminator};
use anyhow::Result;
use clone::decimal::{BPS_SCALE, CLONE_TOKEN_SCALE};
use clone::instruction::{Swap as CloneSwapArgs, UpdatePrices};
use clone::instructions::{CLONE_PROGRAM_SEED, ORACLES_SEED, POOLS_SEED};
use clone::states::{Clone, Oracles, Pools};
use clone::ID as CLONE_PROGRAM_ID;
use jupiter_amm_interface::{
    AccountMap, Amm, AmmUserSetup, KeyedAccount, Quote, QuoteParams, SwapAndAccountMetas, SwapMode,
    SwapParams,
};
use pyth_sdk_solana::state::{load_price_account, SolanaPriceAccount};
use rust_decimal::prelude::*;
use solana_sdk::account::ReadableAccount;
use solana_sdk::clock::Clock;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::sysvar::{self};
use spl_associated_token_account::get_associated_token_address;
use spl_token::ID as SPL_TOKEN_PROGRAM;
use thiserror::Error;

const USDC_MINT: Pubkey = Pubkey::new_from_array([
    198u8, 250u8, 122u8, 243u8, 190u8, 219u8, 173u8, 58u8, 61u8, 101u8, 243u8, 106u8, 171u8, 201u8,
    116u8, 49u8, 177u8, 187u8, 228u8, 194u8, 210u8, 246u8, 224u8, 228u8, 124u8, 166u8, 2u8, 3u8,
    69u8, 47u8, 93u8, 97u8,
]);

pub fn get_clone_account_address() -> Pubkey {
    Pubkey::find_program_address(&[CLONE_PROGRAM_SEED.as_ref()], &CLONE_PROGRAM_ID).0
}
pub fn get_pools_account_address() -> Pubkey {
    Pubkey::find_program_address(&[POOLS_SEED.as_ref()], &CLONE_PROGRAM_ID).0
}
pub fn get_oracles_account_address() -> Pubkey {
    Pubkey::find_program_address(&[ORACLES_SEED.as_ref()], &CLONE_PROGRAM_ID).0
}

#[derive(Clone)]
pub struct CloneInterface {
    pub clone: Option<Clone>,
    pub pools: Pools,
    pub oracles: Option<Oracles>,
    pub pyth_prices: Option<Vec<SolanaPriceAccount>>,
    pub key: Pubkey,
    pub clock: Option<Clock>,
}

impl CloneInterface {
    pub fn create_update_prices_instruction(
        &self,
        oracle_indices: Option<Vec<usize>>,
    ) -> Result<Instruction> {
        let mut account_metas = vec![AccountMeta::new(get_oracles_account_address(), false)];
        let oracles = self.oracles.as_ref().ok_or::<CloneInterfaceError>(
            CloneInterfaceError::PropertyNotLoaded(String::from("oracles")).into(),
        )?;

        let indices_to_update = oracle_indices.unwrap_or((0usize..oracles.oracles.len()).collect());

        indices_to_update.iter().for_each(|index| {
            let address = oracles.oracles[*index].address;
            account_metas.push(AccountMeta::new_readonly(address, false))
        });

        let args = UpdatePrices {
            oracle_indices: indices_to_update.iter().map(|i| *i as u8).collect(),
        };
        let mut data: Vec<u8> = UpdatePrices::discriminator().into_iter().collect();
        data.extend(args.try_to_vec()?.iter());

        Ok(Instruction {
            program_id: self.program_id(),
            accounts: account_metas,
            data,
        })
    }

    pub fn create_swap_instruction(
        &self,
        swap_params: &SwapParams,
        swap_mode: SwapMode,
        slippage_bps: u64,
        quote: Option<Quote>,
    ) -> Result<Instruction> {
        // Fetch quote
        let quantity_is_input = swap_mode == SwapMode::ExactIn;
        let amount = if quantity_is_input {
            swap_params.in_amount
        } else {
            swap_params.out_amount
        };

        let updated_quote = quote.unwrap_or(self.quote(&QuoteParams {
            amount,
            input_mint: swap_params.source_mint,
            output_mint: swap_params.destination_mint,
            swap_mode,
        })?);

        // Create args
        let clone = self.clone.as_ref().ok_or::<CloneInterfaceError>(
            CloneInterfaceError::PropertyNotLoaded(String::from("clone")).into(),
        )?;

        let input_is_collateral = clone.collateral.mint.eq(&swap_params.source_mint);
        let (pool_index, _) = self
            .pools
            .pools
            .iter()
            .enumerate()
            .find(|(_, p)| {
                let classet_mint = p.asset_info.onasset_mint;
                if input_is_collateral {
                    classet_mint.eq(&swap_params.destination_mint)
                } else {
                    classet_mint.eq(&swap_params.source_mint)
                }
            })
            .ok_or::<CloneInterfaceError>(
                CloneInterfaceError::PoolNotFound(
                    swap_params.source_mint,
                    swap_params.destination_mint,
                )
                .into(),
            )?;

        // Create args
        let quantity_is_collateral = (input_is_collateral && quantity_is_input)
            || (!input_is_collateral && !quantity_is_input);
        let slippage_decimal = Decimal::new(slippage_bps.try_into()?, BPS_SCALE);
        let decimal_of_result = if quantity_is_collateral {
            CLONE_TOKEN_SCALE
        } else {
            clone.collateral.scale.try_into()?
        };

        let mut result_threshold_decimal = if quantity_is_input {
            Decimal::new(updated_quote.out_amount.try_into()?, decimal_of_result)
                * (Decimal::ONE - slippage_decimal)
        } else {
            Decimal::new(updated_quote.in_amount.try_into()?, decimal_of_result)
                * (Decimal::ONE + slippage_decimal)
        };
        result_threshold_decimal.rescale(decimal_of_result);
        let result_threshold = result_threshold_decimal.mantissa().try_into()?;

        let args = CloneSwapArgs {
            pool_index: pool_index.try_into()?,
            quantity: amount,
            quantity_is_input,
            quantity_is_collateral,
            result_threshold,
        };
        let mut data: Vec<u8> = CloneSwapArgs::discriminator().into_iter().collect();
        data.extend(args.try_to_vec()?.iter());

        let account_metas = self.get_swap_and_account_metas(swap_params)?.account_metas;

        Ok(Instruction {
            program_id: self.program_id(),
            data,
            accounts: account_metas,
        })
    }

    fn collateral_mint(&self) -> Pubkey {
        USDC_MINT
    }

    fn oracle_slot_threshold(&self) -> u64 {
        20
    }
}

impl Amm for CloneInterface {
    // Load oracle account
    fn from_keyed_account(keyed_account: &KeyedAccount) -> Result<Self> {
        // Key account should correspond to the oracle info
        let mut v = keyed_account.account.data.as_slice();
        let pools = Pools::try_deserialize(&mut v)?;

        Ok(CloneInterface {
            clone: None,
            pools,
            oracles: None,
            pyth_prices: None,
            key: keyed_account.key,
            clock: None,
        })
    }
    /// A human readable label of the underlying DEX
    fn label(&self) -> String {
        String::from("Clone Protocol")
    }
    fn program_id(&self) -> Pubkey {
        CLONE_PROGRAM_ID
    }
    /// The pool state or market state address
    fn key(&self) -> Pubkey {
        get_pools_account_address()
    }
    /// The mints that can be traded
    fn get_reserve_mints(&self) -> Vec<Pubkey> {
        let mut reserve_mints = vec![self.collateral_mint()];
        self.pools
            .pools
            .iter()
            .for_each(|pool| reserve_mints.push(pool.asset_info.onasset_mint));
        reserve_mints
    }
    /// The accounts necessary to produce a quote
    fn get_accounts_to_update(&self) -> Vec<Pubkey> {
        let mut accounts = vec![
            get_clone_account_address(),
            get_pools_account_address(),
            get_oracles_account_address(),
            sysvar::clock::ID,
        ];
        if let Some(oracles) = &self.oracles {
            oracles
                .oracles
                .iter()
                .for_each(|oracle| accounts.push(oracle.address));
        }
        accounts
    }

    /// Picks necessary accounts to update it's internal state
    /// Heavy deserialization and precomputation caching should be done in this function
    fn update(&mut self, account_map: &AccountMap) -> Result<()> {
        let clone_address = get_clone_account_address();
        let clone_account = account_map
            .get(&clone_address)
            .ok_or::<CloneInterfaceError>(CloneInterfaceError::MissingAddress(clone_address))?;
        let mut v = clone_account.data.as_slice();
        self.clone = Some(Clone::try_deserialize(&mut v)?);

        let pools_address = get_pools_account_address();
        let pools_account = account_map
            .get(&pools_address)
            .ok_or::<CloneInterfaceError>(CloneInterfaceError::MissingAddress(pools_address))?;
        let mut v = pools_account.data.as_slice();
        self.pools = Pools::try_deserialize(&mut v)?;

        let oracles_address = get_oracles_account_address();
        let oracles_account = account_map
            .get(&oracles_address)
            .ok_or::<CloneInterfaceError>(CloneInterfaceError::MissingAddress(oracles_address))?;
        let mut v = oracles_account.data.as_slice();
        let oracles = Oracles::try_deserialize(&mut v)?;

        let mut pyth_prices = Vec::new();
        for info in oracles.oracles.iter() {
            if let Some(price_account) = account_map.get(&info.address) {
                let price_account: SolanaPriceAccount = *load_price_account(price_account.data())?;
                pyth_prices.push(price_account)
            }
        }

        self.oracles = Some(oracles);
        self.pyth_prices = Some(pyth_prices);

        let clock_account = account_map
            .get(&sysvar::clock::ID)
            .ok_or::<CloneInterfaceError>(CloneInterfaceError::MissingAddress(sysvar::clock::ID))?;
        let clock: Clock = clock_account.deserialize_data()?;
        self.clock = Some(clock);

        Ok(())
    }

    fn quote(&self, quote_params: &QuoteParams) -> Result<Quote> {
        let clone = self.clone.as_ref().ok_or::<CloneInterfaceError>(
            CloneInterfaceError::PropertyNotLoaded(String::from("clone")).into(),
        )?;
        let pyth_prices = self.pyth_prices.clone().ok_or::<CloneInterfaceError>(
            CloneInterfaceError::PropertyNotLoaded(String::from("pyth_prices")).into(),
        )?;

        let collateral_mint = clone.collateral.mint;

        let input_is_collateral = collateral_mint.eq(&quote_params.input_mint);

        let pool = self
            .pools
            .pools
            .iter()
            .find(|p| {
                let classet_mint = p.asset_info.onasset_mint;
                if input_is_collateral {
                    classet_mint.eq(&quote_params.output_mint)
                } else {
                    classet_mint.eq(&quote_params.input_mint)
                }
            })
            .ok_or::<CloneInterfaceError>(
                CloneInterfaceError::PoolNotFound(
                    quote_params.input_mint,
                    quote_params.output_mint,
                )
                .into(),
            )?;

        let current_clock_slot = self
            .clock
            .as_ref()
            .ok_or::<CloneInterfaceError>(
                CloneInterfaceError::PropertyNotLoaded(String::from("clock")).into(),
            )?
            .slot;
        let threshold_clock_slot = current_clock_slot - self.oracle_slot_threshold();

        let collateral_price_account = pyth_prices[clone.collateral.oracle_info_index as usize];
        if collateral_price_account.last_slot < threshold_clock_slot {
            return Err(CloneInterfaceError::OracleOutdated(
                collateral_price_account.last_slot,
                threshold_clock_slot,
            )
            .into());
        }
        let collateral_price = Decimal::new(
            collateral_price_account.agg.price,
            collateral_price_account.expo.abs() as u32,
        );

        let classet_price_account = pyth_prices[pool.asset_info.oracle_info_index as usize];
        if classet_price_account.last_slot < threshold_clock_slot {
            return Err(CloneInterfaceError::OracleOutdated(
                classet_price_account.last_slot,
                threshold_clock_slot,
            )
            .into());
        }
        let classet_price = Decimal::new(
            classet_price_account.agg.price,
            classet_price_account.expo.abs() as u32,
        );

        let quantity_is_input = quote_params.swap_mode == SwapMode::ExactIn;
        let quantity_is_collateral = (input_is_collateral && quantity_is_input)
            || (!input_is_collateral && !quantity_is_input);

        let quantity = Decimal::new(
            quote_params.amount.try_into()?,
            if quantity_is_collateral {
                clone.collateral.scale.into()
            } else {
                CLONE_TOKEN_SCALE
            },
        );

        let swap_result = pool.calculate_swap(
            classet_price,
            collateral_price,
            quantity,
            quantity_is_input,
            quantity_is_collateral,
            &clone.collateral,
            None,
            None,
        )?;

        let fee_amount: u64 = (swap_result.liquidity_fees_paid.mantissa()
            + swap_result.treasury_fees_paid.mantissa())
        .try_into()?;
        let fee_mint = quote_params.output_mint;
        let fee_pct = Decimal::ONE_HUNDRED
            * Decimal::new(
                (pool.liquidity_trading_fee_bps + pool.treasury_trading_fee_bps) as i64,
                BPS_SCALE,
            );

        let (in_amount, out_amount) = if quantity_is_input {
            (
                quote_params.amount,
                swap_result.result.mantissa().try_into()?,
            )
        } else {
            (
                swap_result.result.mantissa().try_into()?,
                quote_params.amount,
            )
        };

        Ok(Quote {
            not_enough_liquidity: false,
            min_in_amount: None,
            min_out_amount: None,
            in_amount,
            out_amount,
            fee_amount,
            fee_mint,
            fee_pct,
        })
    }

    /// Indicates which Swap has to be performed along with all the necessary account metas
    fn get_swap_and_account_metas(&self, swap_params: &SwapParams) -> Result<SwapAndAccountMetas> {
        let clone = self.clone.as_ref().ok_or::<CloneInterfaceError>(
            CloneInterfaceError::PropertyNotLoaded(String::from("clone")).into(),
        )?;
        let oracles = self.oracles.as_ref().ok_or::<CloneInterfaceError>(
            CloneInterfaceError::PropertyNotLoaded(String::from("oracles")).into(),
        )?;
        let input_is_collateral = clone.collateral.mint.eq(&swap_params.source_mint);
        let classet_mint = if input_is_collateral {
            swap_params.destination_mint
        } else {
            swap_params.source_mint
        };
        let pool = self
            .pools
            .pools
            .iter()
            .find(|p| {
                let classet_mint = p.asset_info.onasset_mint;
                if input_is_collateral {
                    classet_mint.eq(&swap_params.destination_mint)
                } else {
                    classet_mint.eq(&swap_params.source_mint)
                }
            })
            .ok_or::<CloneInterfaceError>(
                CloneInterfaceError::PoolNotFound(
                    swap_params.source_mint,
                    swap_params.destination_mint,
                )
                .into(),
            )?;

        let mut account_metas = Vec::new();

        // user
        account_metas.push(AccountMeta::new(swap_params.token_transfer_authority, true));
        // clone
        account_metas.push(AccountMeta::new(get_clone_account_address(), false));
        // pools
        account_metas.push(AccountMeta::new(get_pools_account_address(), false));
        // oracles
        account_metas.push(AccountMeta::new(get_oracles_account_address(), false));
        // user collateral token account
        account_metas.push(AccountMeta::new(
            get_associated_token_address(
                &swap_params.token_transfer_authority,
                &clone.collateral.mint,
            ),
            false,
        ));
        // user classet token account
        account_metas.push(AccountMeta::new(
            get_associated_token_address(&swap_params.token_transfer_authority, &classet_mint),
            false,
        ));
        // classet mint
        account_metas.push(AccountMeta::new(classet_mint, false));
        // collateral mint
        account_metas.push(AccountMeta::new_readonly(clone.collateral.mint, false));
        // collateral vault
        account_metas.push(AccountMeta::new(clone.collateral.vault, false));
        // treasury classet token account
        account_metas.push(AccountMeta::new(
            get_associated_token_address(&clone.treasury_address, &classet_mint),
            false,
        ));
        // treasury collateral token account
        account_metas.push(AccountMeta::new(
            get_associated_token_address(&clone.treasury_address, &clone.collateral.mint),
            false,
        ));
        // token program
        account_metas.push(AccountMeta::new_readonly(SPL_TOKEN_PROGRAM, false));

        // Rest of the accounts are optional
        account_metas.push(AccountMeta::new_readonly(CLONE_PROGRAM_ID, false));
        account_metas.push(AccountMeta::new_readonly(CLONE_PROGRAM_ID, false));
        account_metas.push(AccountMeta::new_readonly(CLONE_PROGRAM_ID, false));

        // Remaining accounts, to update the oracle struct
        account_metas.push(AccountMeta::new_readonly(
            oracles.oracles[clone.collateral.oracle_info_index as usize].address,
            false,
        ));
        account_metas.push(AccountMeta::new_readonly(
            oracles.oracles[pool.asset_info.oracle_info_index as usize].address,
            false,
        ));

        Ok(SwapAndAccountMetas {
            swap: jupiter_amm_interface::Swap::Saber, // TODO: This should be Clone enum
            account_metas,
        })
    }

    /// Indicates if get_accounts_to_update might return a non constant vec
    fn has_dynamic_accounts(&self) -> bool {
        true
    }

    fn get_user_setup(&self) -> Option<AmmUserSetup> {
        None
    }

    fn clone_amm(&self) -> Box<dyn Amm + Send + Sync> {
        Box::new(self.clone())
    }

    /// It can only trade in one direction from its first mint to second mint, assuming it is a two mint AMM
    fn unidirectional(&self) -> bool {
        false
    }

    /// For testing purposes, provide a mapping of dependency programs to function
    fn program_dependencies(&self) -> Vec<(Pubkey, String)> {
        vec![]
    }

    fn get_accounts_len(&self) -> usize {
        32 // Default to a near whole legacy transaction to penalize no implementation
    }

    fn requires_update_for_reserve_mints(&self) -> bool {
        true
    }
}

#[derive(Debug, Error)]
pub enum CloneInterfaceError {
    #[error("Address missing: {0}")]
    MissingAddress(Pubkey),

    #[error("Property not loaded: {0}")]
    PropertyNotLoaded(String),

    #[error("Pool not found for mints {0} {1}")]
    PoolNotFound(Pubkey, Pubkey),

    #[error("Type conversion failed for {0}")]
    TypeConversionFailed(String),

    #[error("Oracle is outdated, {0} vs {1}")]
    OracleOutdated(u64, u64),
}
