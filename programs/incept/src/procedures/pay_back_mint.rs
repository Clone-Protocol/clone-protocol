use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn};
use rust_decimal::prelude::*;
use std::convert::TryInto;

use crate::instructions::PayBackiAssetToMint;

pub fn execute(
    ctx: Context<PayBackiAssetToMint>,
    _manager_nonce: u8,
    mint_index: u8,
    amount: u64,
) -> ProgramResult {
    let amount_value = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let mint_positions = &mut ctx.accounts.mint_positions.load_mut()?;
    let mint_position = mint_positions.mint_positions[mint_index as usize];

    // burn user iasset to pay back mint position
    let cpi_ctx_burn: CpiContext<Burn> = CpiContext::from(&*ctx.accounts);
    token::burn(cpi_ctx_burn, amount)?;

    // update total amount of borrowed iasset
    let updated_borrowed_iasset = mint_position.borrowed_iasset.to_decimal() - amount_value;
    mint_positions.mint_positions[mint_index as usize].borrowed_iasset =
        RawDecimal::from(updated_borrowed_iasset);

    Ok(())
}
