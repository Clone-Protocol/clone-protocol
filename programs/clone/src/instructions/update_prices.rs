use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::ORACLES_SEED;
use anchor_lang::prelude::*;
use pyth_sdk_solana::state::SolanaPriceAccount;
use std::convert::TryInto;
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
        let supplied_oracle_address = &remaining_accounts[account_index];
        let oracle_index = *oracle_index as usize;
        let oracle: &mut OracleInfo = &mut oracles.oracles[oracle_index];

        return_error_if_false!(
            supplied_oracle_address.key().eq(&oracle.address),
            CloneError::IncorrectOracleAddress
        );

        let (price, expo) = match oracle.source {
            OracleSource::PYTH => {
                if let Ok(price_info) =
                    SolanaPriceAccount::account_info_to_feed(&supplied_oracle_address)
                {
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
                } else {
                    return Err(error!(CloneError::FailedToLoadPyth));
                }
            }
            OracleSource::SWITCHBOARD => {
                let raw = supplied_oracle_address.try_borrow_data()?;
                let data_feed = AggregatorAccountData::new_from_bytes(*raw)
                    .map_err(|_| error!(CloneError::FailedToLoadSwitchboard))?;
                let result = data_feed
                    .get_result()
                    .map_err(|_| error!(CloneError::FailedToLoadSwitchboard))?;
                (
                    result
                        .mantissa
                        .try_into()
                        .map_err(|_| CloneError::IntTypeConversionError)?,
                    result
                        .scale
                        .try_into()
                        .map_err(|_| CloneError::IntTypeConversionError)?,
                )
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
