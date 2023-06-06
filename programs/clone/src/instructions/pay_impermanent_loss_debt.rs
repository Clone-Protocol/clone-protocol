use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8, amount: u64)]
pub struct PayImpermanentLossDebt<'info> {
    #[account(address = comet.load()?.owner)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet || comet.to_account_info().key() == user_account.single_pool_comets @ CloneError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ CloneError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = onusd_mint,
    )]
    pub user_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = onasset_mint,
    )]
    pub user_onasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onusd_token_account
    )]
    pub amm_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].onasset_token_account
    )]
    pub amm_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<PayImpermanentLossDebt>,
    comet_position_index: u8,
    amount: u64,
    pay_onusd_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);

    let token_data = ctx.accounts.token_data.load()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let comet_position = comet.positions[comet_position_index as usize];
    let authorized_amount = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);
    let pool_index = comet_position.pool_index as usize;
    let pool = token_data.pools[pool_index];
    let claimable_ratio = calculate_liquidity_proportion_from_liquidity_tokens(
        comet_position.liquidity_token_value.to_decimal(),
        pool.liquidity_token_supply.to_decimal(),
    );

    let (from_context, mint_context, payment_amount) = if pay_onusd_debt {
        let claimable_onusd = rescale_toward_zero(
            claimable_ratio * pool.onusd_amount.to_decimal(),
            DEVNET_TOKEN_SCALE,
        );
        let borrowed_onusd = comet_position.borrowed_onusd.to_decimal();
        let payment_amount = rescale_toward_zero(
            (borrowed_onusd - claimable_onusd).min(authorized_amount),
            DEVNET_TOKEN_SCALE,
        );

        if borrowed_onusd <= claimable_onusd {
            return Ok(());
        }

        let new_borrowed_amount = rescale_toward_zero(
            comet_position.borrowed_onusd.to_decimal() - payment_amount,
            DEVNET_TOKEN_SCALE,
        );
        comet.positions[comet_position_index as usize].borrowed_onusd =
            RawDecimal::from(new_borrowed_amount);

        (
            ctx.accounts
                .user_onusd_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.onusd_mint.to_account_info().clone(),
            payment_amount,
        )
    } else {
        let claimable_onasset = rescale_toward_zero(
            claimable_ratio * pool.onasset_amount.to_decimal(),
            DEVNET_TOKEN_SCALE,
        );
        let borrowed_onasset = comet_position.borrowed_onasset.to_decimal();
        let payment_amount = rescale_toward_zero(
            (borrowed_onasset - claimable_onasset).min(authorized_amount),
            DEVNET_TOKEN_SCALE,
        );

        if borrowed_onasset <= claimable_onasset {
            return Ok(());
        }

        let new_borrowed_amount = rescale_toward_zero(
            comet_position.borrowed_onasset.to_decimal() - payment_amount,
            DEVNET_TOKEN_SCALE,
        );
        comet.positions[comet_position_index as usize].borrowed_onasset =
            RawDecimal::from(new_borrowed_amount);

        (
            ctx.accounts
                .user_onasset_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.onasset_mint.to_account_info().clone(),
            payment_amount,
        )
    };

    let cpi_accounts = Burn {
        from: from_context,
        mint: mint_context,
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::burn(
        CpiContext::new(cpi_program, cpi_accounts),
        payment_amount.mantissa().try_into().unwrap(),
    )?;

    Ok(())
}
