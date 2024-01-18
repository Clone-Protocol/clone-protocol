use anchor_lang::prelude::*;
use bytemuck::{cast_slice_mut, from_bytes_mut, try_cast_slice_mut};
use pyth_sdk_solana::state::{AccountType, PriceAccount, PriceType, MAGIC, VERSION_2};
use std::cell::RefMut;

declare_id!("CgcVKPBdW6cVDGKAKDHfN5rAoSN9m9MUuiymSrdbN27k");

pub fn load_price_account<'a>(price_feed: &'a AccountInfo) -> Result<RefMut<'a, PriceAccount>> {
    let raw = price_feed.try_borrow_mut_data().unwrap();
    let account_data: RefMut<'a, [u8]> = RefMut::map(raw, |data| *data);
    let state: RefMut<'a, PriceAccount> = RefMut::map(account_data, |data| {
        from_bytes_mut(cast_slice_mut::<u8, u8>(try_cast_slice_mut(data).unwrap()))
    });
    Ok(state)
}

#[program]
pub mod pyth {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, price: i64, expo: i32) -> Result<()> {
        let mut price_account = load_price_account(&ctx.accounts.price_account)?;
        price_account.prev_price = price;
        price_account.agg.price = price;
        price_account.agg.conf = 0;
        price_account.expo = expo.into();
        price_account.magic = MAGIC;
        price_account.ptype = PriceType::Price;
        price_account.atype = AccountType::Price as u32;
        price_account.ver = VERSION_2;
        Ok(())
    }

    pub fn set_price(ctx: Context<SetPrice>, price: i64) -> Result<()> {
        let mut price_account = load_price_account(&ctx.accounts.price_account)?;
        price_account.prev_price = price;
        price_account.agg.price = price;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(price: i64, expo: i8)]
pub struct Initialize<'info> {
    /// CHECK: Mock program
    #[account(mut)]
    pub price_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(price: i64)]
pub struct SetPrice<'info> {
    /// CHECK: Mock program
    #[account(mut)]
    pub price_account: UncheckedAccount<'info>,
}
