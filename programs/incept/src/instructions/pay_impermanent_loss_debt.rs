use crate::error::*;
use crate::math::calculate_health_score;
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
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Box<Account<'info, Incept>>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        constraint = comet.to_account_info().key() == user_account.comet || comet.to_account_info().key() == user_account.single_pool_comets @ InceptError::InvalidAccountLoaderOwner,
        constraint = comet.load()?.num_positions > comet_position_index.into() @ InceptError::InvalidInputPositionIndex
    )]
    pub comet: AccountLoader<'info, Comet>,
    #[account(
        mut,
        address = incept.usdi_mint
    )]
    pub usdi_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].asset_info.iasset_mint,
    )]
    pub iasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = usdi_mint,
    )]
    pub user_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = user,
        associated_token::mint = iasset_mint,
    )]
    pub user_iasset_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].usdi_token_account
    )]
    pub amm_usdi_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].iasset_token_account
    )]
    pub amm_iasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<PayImpermanentLossDebt>,
    comet_position_index: u8,
    amount: u64,
    pay_usdi_debt: bool,
) -> Result<()> {
    let token_data = ctx.accounts.token_data.load()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let comet_position = comet.positions[comet_position_index as usize];
    let payment_amount = Decimal::new(amount.try_into().unwrap(), DEVNET_TOKEN_SCALE);

    let (from_context, mint_context) = if pay_usdi_debt {
        return_error_if_false!(
            payment_amount <= comet_position.borrowed_usdi.to_decimal(),
            InceptError::InvalidTokenAmount
        );
        let mut new_borrowed_amount = comet_position.borrowed_usdi.to_decimal() - payment_amount;
        new_borrowed_amount.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_usdi =
            RawDecimal::from(new_borrowed_amount);

        (
            ctx.accounts
                .user_usdi_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.usdi_mint.to_account_info().clone(),
        )
    } else {
        return_error_if_false!(
            payment_amount <= comet_position.borrowed_iasset.to_decimal(),
            InceptError::InvalidTokenAmount
        );
        let mut new_borrowed_amount = comet_position.borrowed_iasset.to_decimal() - payment_amount;
        new_borrowed_amount.rescale(DEVNET_TOKEN_SCALE);
        comet.positions[comet_position_index as usize].borrowed_iasset =
            RawDecimal::from(new_borrowed_amount);

        (
            ctx.accounts
                .user_iasset_token_account
                .to_account_info()
                .clone(),
            ctx.accounts.iasset_mint.to_account_info().clone(),
        )
    };

    let cpi_accounts = Burn {
        from: from_context,
        mint: mint_context,
        authority: ctx.accounts.user.to_account_info().clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();

    token::burn(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    // TODO: Update token data.

    let single_pool_position_index = if comet.is_single_pool == 1 {
        Some(comet_position_index as usize)
    } else {
        None
    };
    let health_score = calculate_health_score(&comet, &token_data, single_pool_position_index)?;
    return_error_if_false!(health_score.is_healthy(), InceptError::HealthScoreTooLow);

    Ok(())
}
