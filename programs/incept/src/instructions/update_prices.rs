use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use pyth::pc::Price;
use rust_decimal::prelude::*;
use std::convert::TryInto;

pub const MAX_SIZE: usize = 128;

#[zero_copy]
#[derive(PartialEq, Eq, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct PoolIndices {
    pub indices: [u8; MAX_SIZE],
}

#[derive(Accounts)]
#[instruction( pool_indices: PoolIndices)]
pub struct UpdatePrices<'info> {
    #[account(
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrices<'info>>,

    pool_indices: PoolIndices,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let n_accounts = ctx.remaining_accounts.iter().len();
    return_error_if_false!(n_accounts > 0, InceptError::NoRemainingAccountsSupplied);

    // generate data from  pyth oracle
    for i in 0..n_accounts {
        let pool_index = pool_indices.indices[i] as usize;
        let pyth_oracle = &ctx.remaining_accounts[i];
        return_error_if_false!(
            pyth_oracle.key()
                == token_data.pools[pool_index].asset_info.price_feed_addresses[0].key(),
            InceptError::IncorrectOracleAddress
        );

        let price_feed = Price::load(pyth_oracle)?;
        let expo: u32 = price_feed.expo.abs().try_into().unwrap();
        let pyth_price = Decimal::new(price_feed.agg.price, expo);

        // update price data
        token_data.pools[pool_index].asset_info.price = RawDecimal::from(pyth_price);
        token_data.pools[pool_index].asset_info.twap = RawDecimal::new(price_feed.twap, expo);
        token_data.pools[pool_index].asset_info.confidence =
            RawDecimal::new(price_feed.agg.conf.try_into().unwrap(), expo);
        token_data.pools[pool_index].asset_info.status = price_feed.agg.status as u64;
        token_data.pools[pool_index].asset_info.last_update = Clock::get()?.slot;
    }

    Ok(())
}
