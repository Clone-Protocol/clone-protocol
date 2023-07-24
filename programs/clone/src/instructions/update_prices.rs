use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;
use pyth_sdk_solana::Price;
use std::convert::TryInto;

pub const MAX_SIZE: usize = 128;

#[cfg(feature = "pyth-local")]
fn load_price_from_pyth(pyth_oracle: &AccountInfo) -> Result<Price> {
    use pyth::pc::Price as LocalPrice;
    if let Ok(price_feed) = LocalPrice::load(pyth_oracle) {
        Ok(Price {
            price: price_feed.agg.price,
            expo: price_feed.expo,
            conf: price_feed.agg.conf,
            publish_time: price_feed.valid_slot.try_into().unwrap(),
        })
    } else {
        Err(error!(CloneError::FailedToLoadPyth))
    }
}

#[cfg(not(feature = "pyth-local"))]
fn load_price_from_pyth(pyth_oracle: &AccountInfo) -> Result<Price> {
    use pyth_sdk_solana::load_price_feed_from_account_info;
    if let Ok(price_feed) = load_price_feed_from_account_info(pyth_oracle) {
        // TODO: Switch over to `get_price_no_older_than` method.
        Ok(price_feed.get_price_unchecked())
    } else {
        Err(error!(CloneError::FailedToLoadPyth))
    }
}

#[zero_copy]
#[derive(PartialEq, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct OracleIndices {
    pub indices: [u8; MAX_SIZE],
}

#[derive(Accounts)]
#[instruction(oracle_indices: OracleIndices)]
pub struct UpdatePrices<'info> {
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
    oracle_indices: OracleIndices,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let n_accounts = ctx.remaining_accounts.iter().len();
    return_error_if_false!(n_accounts > 0, CloneError::NoRemainingAccountsSupplied);

    // generate data from pyth oracle
    for i in 0..n_accounts {
        let oracle_index = oracle_indices.indices[i] as usize;
        let pyth_oracle = &ctx.remaining_accounts[i];
        return_error_if_false!(
            pyth_oracle.key() == token_data.oracles[oracle_index].pyth_address,
            CloneError::IncorrectOracleAddress
        );

        let price = load_price_from_pyth(pyth_oracle)?;
        let expo = (-price.expo).try_into().unwrap();

        // update price data
        token_data.oracles[oracle_index].price = RawDecimal::new(price.price, expo);
        token_data.oracles[oracle_index].last_update_slot = Clock::get()?.slot;
    }

    Ok(())
}
