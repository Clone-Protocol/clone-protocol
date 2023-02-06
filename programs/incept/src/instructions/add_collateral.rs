use crate::error::InceptError;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(manager_nonce: u8, scale: u8, stable: u8, collateralization_ratio: u64)]
pub struct AddCollateral<'info> {
    #[account(mut, address = manager.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"manager".as_ref()],
        bump = manager_nonce,
        has_one = token_data,
        has_one = admin
    )]
    pub manager: Account<'info, Manager>,
    #[account(
        mut,
        has_one = manager
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        token::mint = collateral_mint,
        token::authority = manager,
        payer = admin
    )]
    pub vault: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<AddCollateral>,
    _manager_nonce: u8,
    scale: u8,
    stable: u8,
    collateralization_ratio: u64,
) -> Result<()> {
    return_error_if_false!(
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
    let is_stable: Result<bool> = match stable {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(InceptError::InvalidBool)),
    };

    // if the collateral is not stable, store its pool index, which shall store its oracle data
    if !(is_stable.unwrap()) {
        pool_index = TokenData::get_pool_tuple_from_oracle(
            token_data,
            [
                (ctx.remaining_accounts[0].to_account_info().key),
                (ctx.remaining_accounts[1].to_account_info().key),
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
