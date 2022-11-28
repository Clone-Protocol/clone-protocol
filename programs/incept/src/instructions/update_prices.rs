use anchor_lang::prelude::*;
use pyth::pc::Price;
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::error::*;
use crate::states::*;

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
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let n_accounts = ctx.remaining_accounts.iter().len();
    require!(n_accounts > 0, InceptError::NoRemainingAccountsSupplied);

    // generate data from  pyth oracle
    for i in 0..n_accounts {
        let pool_index = pool_indices.indices[i] as usize;
        let pyth_oracle = &ctx.remaining_accounts[i];
        require!(
            pyth_oracle.key()
                == token_data.pools[pool_index].asset_info.price_feed_addresses[0].key(),
            InceptError::IncorrectOracleAddress
        );

        let price_feed = Price::load(pyth_oracle)?;
        let expo: u32 = price_feed.expo.abs().try_into().unwrap();
        let pyth_price = Decimal::new(price_feed.agg.price.try_into().unwrap(), expo);

        // update price data
        token_data.pools[pool_index].asset_info.price = RawDecimal::from(pyth_price);
        token_data.pools[pool_index].asset_info.twap =
            RawDecimal::new(price_feed.twap.try_into().unwrap(), expo);
        token_data.pools[pool_index].asset_info.confidence =
            RawDecimal::new(price_feed.agg.conf.try_into().unwrap(), expo);
        token_data.pools[pool_index].asset_info.status = price_feed.agg.status as u64;
        token_data.pools[pool_index].asset_info.last_update = Clock::get()?.slot;
    }

    Ok(())
}
