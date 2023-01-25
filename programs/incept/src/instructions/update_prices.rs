use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use pyth_sdk_solana::Price;
use std::convert::TryInto;

#[cfg(feature = "pyth-local")]
fn load_price_from_pyth(pyth_oracle: &AccountInfo) -> Result<Price, InceptError> {
    use pyth::pc::Price as LocalPrice;
    if let Ok(price_feed) = LocalPrice::load(pyth_oracle) {
        Ok(Price {
            price: price_feed.agg.price,
            expo: price_feed.expo,
            conf: price_feed.agg.conf,
            publish_time: price_feed.valid_slot.try_into().unwrap(),
        })
    } else {
        Err(InceptError::FailedToLoadPyth)
    }
}

#[cfg(not(feature = "pyth-local"))]
fn load_price_from_pyth(pyth_oracle: &AccountInfo) -> Result<Price, InceptError> {
    use pyth_sdk_solana::load_price_feed_from_account_info;
    if let Ok(price_feed) = load_price_feed_from_account_info(pyth_oracle) {
        // TODO: Switch over to `get_price_no_older_than` method.
        Ok(price_feed.get_price_unchecked())
    } else {
        Err(InceptError::FailedToLoadPyth)
    }
}

pub const MAX_SIZE: usize = 128;

#[zero_copy]
#[derive(PartialEq, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct PoolIndices {
    pub indices: [u8; MAX_SIZE],
}

#[derive(Accounts)]
#[instruction(manager_nonce: u8, pool_indices: PoolIndices)]
pub struct UpdatePrices<'info> {
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,
    _manager_nonce: u8,
    pool_indices: PoolIndices,
) -> ProgramResult {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let n_accounts = ctx.remaining_accounts.iter().len();

    require!(n_accounts > 0, InceptError::NoRemainingAccountsSupplied);

    // generate data from pyth oracle
    for i in 0..n_accounts {
        let pool_index = pool_indices.indices[i] as usize;
        let pyth_oracle = &ctx.remaining_accounts[i];
        require!(
            pyth_oracle.key()
                == token_data.pools[pool_index].asset_info.price_feed_addresses[0].key(),
            InceptError::IncorrectOracleAddress
        );

        let price = load_price_from_pyth(pyth_oracle)?;
        let expo = (price.expo * -1).try_into().unwrap();

        // update price data
        token_data.pools[pool_index].asset_info.price = RawDecimal::new(price.price, expo);
        // token_data.pools[pool_index].asset_info.twap =
        //     RawDecimal::new(price_feed.twap.try_into().unwrap(), expo);
        token_data.pools[pool_index].asset_info.confidence =
            RawDecimal::new(price.conf.try_into().unwrap(), expo);
        //token_data.pools[pool_index].asset_info.status = price_feed.agg.status as u64;
        token_data.pools[pool_index].asset_info.last_update = Clock::get()?.slot;
    }

    Ok(())
}
