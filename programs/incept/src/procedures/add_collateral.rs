use crate::error::InceptError;
use crate::instructions::AddCollateral;
use crate::states::*;
use anchor_lang::prelude::*;
use std::convert::TryInto;

pub fn execute(
    ctx: Context<AddCollateral>,
    _manager_nonce: u8,
    scale: u8,
    stable: u8,
    collateralization_ratio: u64,
) -> ProgramResult {
    require!(
        if stable == 0 {
            collateralization_ratio > 0
        } else {
            true
        },
        InceptError::NonZeroCollateralizationRatioRequired
    );

    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let mut pool_index: u8 = u8::MAX;

    // check whether new collateral is stable (pegged to the US dollar)
    let is_stable: Result<bool, InceptError> = match stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(InceptError::InvalidBool),
    };

    // if the collateral is not stable, store its pool index, which shall store its oracle data
    if !(is_stable.unwrap()) {
        pool_index = TokenData::get_pool_tuple_from_oracle(
            token_data,
            [
                &ctx.remaining_accounts[0].to_account_info().key,
                &ctx.remaining_accounts[1].to_account_info().key,
            ],
        )
        .unwrap()
        .1
        .try_into()
        .unwrap();
    }

    // append collateral to list
    token_data.append_collateral(Collateral {
        pool_index: pool_index.try_into().unwrap(),
        mint: *ctx.accounts.collateral_mint.to_account_info().key,
        vault: *ctx.accounts.vault.to_account_info().key,
        vault_usdi_supply: RawDecimal::new(0, scale.into()),
        vault_mint_supply: RawDecimal::new(0, scale.into()),
        vault_comet_supply: RawDecimal::new(0, scale.into()),
        stable: stable as u64,
        collateralization_ratio: RawDecimal::new(
            collateralization_ratio.try_into().unwrap(),
            DEVNET_TOKEN_SCALE,
        ),
    });

    Ok(())
}
