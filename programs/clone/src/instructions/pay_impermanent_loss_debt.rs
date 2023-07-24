use crate::error::*;
use crate::math::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, comet_position_index: u8, amount: u64, pay_onusd_debt: bool)]
pub struct PayImpermanentLossDebt<'info> {
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"user".as_ref(), user.as_ref()],
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
        has_one = clone,
        constraint = token_data.load()?.pools[comet.load()?.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = user_account.comet,
        constraint = comet.load()?.owner == user @ CloneError::InvalidAccountLoaderOwner,
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
        associated_token::authority = payer,
        associated_token::mint = onusd_mint,
    )]
    pub payer_onusd_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::authority = payer,
        associated_token::mint = onasset_mint,
    )]
    pub payer_onasset_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(
    ctx: Context<PayImpermanentLossDebt>,
    _user: Pubkey,
    comet_position_index: u8,
    amount: u64,
    pay_onusd_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let authorized_amount = Decimal::new(amount.try_into().unwrap(), CLONE_TOKEN_SCALE);
    let token_data = ctx.accounts.token_data.load()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let comet_position = comet.positions[comet_position_index as usize];
    let onusd_ild_rebate = comet_position.onusd_ild_rebate.to_decimal();
    let onasset_ild_rebate = comet_position.onasset_ild_rebate.to_decimal();
    let ild_share = calculate_ild_share(&comet_position, &token_data);

    if (pay_onusd_debt && ild_share.onusd_ild_share <= Decimal::ZERO)
        || (!pay_onusd_debt && ild_share.onasset_ild_share <= Decimal::ZERO)
    {
        return Ok(());
    }

    let (cpi_accounts, burn_amount) = if pay_onusd_debt {
        let burn_amount = ild_share.onusd_ild_share.min(authorized_amount);
        comet.positions[comet_position_index as usize].onusd_ild_rebate = RawDecimal::from(
            rescale_toward_zero(onusd_ild_rebate + burn_amount, CLONE_TOKEN_SCALE),
        );

        (
            Burn {
                mint: ctx.accounts.onusd_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .payer_onusd_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.payer.to_account_info().clone(),
            },
            burn_amount,
        )
    } else {
        let burn_amount = ild_share.onasset_ild_share.min(authorized_amount);
        comet.positions[comet_position_index as usize].onasset_ild_rebate = RawDecimal::from(
            rescale_toward_zero(onasset_ild_rebate + burn_amount, CLONE_TOKEN_SCALE),
        );
        (
            Burn {
                mint: ctx.accounts.onasset_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .payer_onasset_token_account
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.payer.to_account_info().clone(),
            },
            burn_amount,
        )
    };

    token::burn(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        burn_amount.mantissa().try_into().unwrap(),
    )?;

    Ok(())
}
