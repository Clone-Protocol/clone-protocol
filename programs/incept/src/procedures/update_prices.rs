use anchor_lang::prelude::*;
use chainlink_solana as chainlink;
use pyth::pc::Price;
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::error::*;
use crate::states::*;

use crate::instructions::UpdatePrices;

pub fn execute<'info>(
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
