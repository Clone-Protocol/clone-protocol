use crate::decimal::rescale_toward_zero;
use crate::decimal::CLONE_TOKEN_SCALE;
use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::ORACLES_SEED;
use anchor_lang::prelude::*;
use anchor_lang::AnchorDeserialize;
use pyth_sdk_solana::state::SolanaPriceAccount;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};
use rust_decimal::Decimal;
use std::convert::TryInto;
use switchboard_solana::prelude::AccountDeserialize;
use switchboard_solana::AggregatorAccountData;

#[derive(Accounts)]
#[instruction(oracle_indices: Vec<u8>)]
pub struct UpdatePrices<'info> {
    #[account(
        mut,
        seeds = [ORACLES_SEED.as_ref()],
        bump,
    )]
    pub oracles: Box<Account<'info, Oracles>>,
}

pub fn update_oracles(
    oracles: &mut Oracles,
    oracle_indices: Vec<u8>,
    remaining_accounts: &[AccountInfo],
) -> Result<()> {
    // generate data from pyth oracle
    for (account_index, oracle_index) in oracle_indices.iter().enumerate() {
        let supplied_oracle_account = &remaining_accounts[account_index];
        let oracle_index = *oracle_index as usize;
        let oracle: &mut OracleInfo = &mut oracles.oracles[oracle_index];

        return_error_if_false!(
            supplied_oracle_account.key().eq(&oracle.address),
            CloneError::IncorrectOracleAddress
        );

        let (price, expo) = match oracle.source {
            OracleSource::PYTH => {
                let price_info = SolanaPriceAccount::account_info_to_feed(&supplied_oracle_account)
                    .map_err(|_| error!(CloneError::FailedToLoadPyth))?;
                // TODO: Consider updating this to check latest ts/conf
                let info = price_info.get_price_unchecked();
                if info.expo <= 0 {
                    (
                        info.price,
                        (-info.expo)
                            .try_into()
                            .map_err(|_| CloneError::IntTypeConversionError)?,
                    )
                } else {
                    (
                        info.price
                            .checked_mul(
                                10_i64
                                    .checked_pow(
                                        info.expo
                                            .try_into()
                                            .map_err(|_| CloneError::IntTypeConversionError)?,
                                    )
                                    .ok_or(error!(CloneError::CheckedMathError))?,
                            )
                            .ok_or(error!(CloneError::CheckedMathError))?,
                        0,
                    )
                }
            }
            OracleSource::SWITCHBOARD => {
                let raw = supplied_oracle_account.try_borrow_data()?;
                let data_feed = AggregatorAccountData::new_from_bytes(*raw)
                    .map_err(|_| error!(CloneError::FailedToLoadSwitchboard))?;
                let switchboard_result = data_feed
                    .get_result()
                    .map_err(|_| error!(CloneError::FailedToLoadSwitchboard))?;
                let result = rescale_toward_zero(
                    Decimal::from_i128_with_scale(
                        switchboard_result.mantissa,
                        switchboard_result.scale,
                    ),
                    CLONE_TOKEN_SCALE,
                );
                (
                    result
                        .mantissa()
                        .try_into()
                        .map_err(|_| CloneError::IntTypeConversionError)?,
                    result
                        .scale()
                        .try_into()
                        .map_err(|_| CloneError::IntTypeConversionError)?,
                )
            }
            OracleSource::PYTHV2 => {
                let price_feed_account_data = supplied_oracle_account.try_borrow_data()?;
                let price_info = PriceUpdateV2::try_deserialize(&mut &price_feed_account_data[..])
                    .map_err(|_| error!(CloneError::FailedToLoadPyth))?;
                let info = price_info
                    .get_price_unchecked(&price_info.price_message.feed_id)
                    .map_err(|_| error!(CloneError::FailedToLoadPyth))?;
                return_error_if_false!(
                    price_info.verification_level.gte(VerificationLevel::Full),
                    CloneError::FailedToLoadPyth
                );
                if info.exponent <= 0 {
                    (
                        info.price,
                        (-info.exponent)
                            .try_into()
                            .map_err(|_| CloneError::IntTypeConversionError)?,
                    )
                } else {
                    (
                        info.price
                            .checked_mul(
                                10_i64
                                    .checked_pow(
                                        info.exponent
                                            .try_into()
                                            .map_err(|_| CloneError::IntTypeConversionError)?,
                                    )
                                    .ok_or(error!(CloneError::CheckedMathError))?,
                            )
                            .ok_or(error!(CloneError::CheckedMathError))?,
                        0,
                    )
                }
            }
        };

        msg!("PRICE: {} {}", price, expo);

        oracles.oracles[oracle_index].price = price;
        oracles.oracles[oracle_index].expo = expo;
        oracles.oracles[oracle_index].last_update_slot = Clock::get()?.slot;

        msg!("UPDATED ORACLE: {:?}", oracles.oracles[oracle_index]);
    }

    Ok(())
}

pub fn execute<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
    oracle_indices: Vec<u8>,
) -> Result<()> {
    let oracles = &mut ctx.accounts.oracles;

    update_oracles(oracles, oracle_indices, ctx.remaining_accounts)
}
