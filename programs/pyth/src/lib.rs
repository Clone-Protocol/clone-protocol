use anchor_lang::prelude::*;
pub mod pc;
use pc::Price;

declare_id!("EERmAuBdXCAZitXKg1E2GaxFtwWDjZSctXKCvuWT19ki");

#[program]
pub mod pyth {
    #![allow(clippy::all)]

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, price: i64, expo: i32, _conf: u64) -> Result<()> {
        let oracle = &ctx.accounts.price;

        let mut price_oracle = Price::load(&oracle).unwrap();

        price_oracle.agg.price = price;
        price_oracle.agg.conf = 0;

        price_oracle.twap = price;
        price_oracle.expo = expo;
        price_oracle.ptype = pc::PriceType::Price;

        Ok(())
    }

    pub fn set_price(ctx: Context<SetPrice>, price: i64) -> Result<()> {
        let oracle = &ctx.accounts.price;
        let mut price_oracle = Price::load(&oracle).unwrap();

        price_oracle.twap = price_oracle
            .twap
            .checked_add(price)
            .unwrap()
            .checked_div(2)
            .unwrap(); //todo
        price_oracle.agg.price = price as i64;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetPrice<'info> {
    /// CHECK: Mock program
    #[account(mut)]
    pub price: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// CHECK: Mock program
    #[account(mut)]
    pub price: AccountInfo<'info>,
}
