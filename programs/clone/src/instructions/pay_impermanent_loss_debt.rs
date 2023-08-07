use crate::error::*;
use crate::math::*;
use crate::states::*;
use crate::to_clone_decimal;
use crate::{return_error_if_false, CLONE_PROGRAM_SEED, TOKEN_DATA_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, comet_position_index: u8, amount: u64, pay_onusd_debt: bool)]
pub struct PayImpermanentLossDebt<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED.as_ref(), user.as_ref()],
        bump,
        constraint = user_account.load()?.comet.num_positions > comet_position_index.into() @ CloneError::InvalidInputPositionIndex
    )]
    pub user_account: AccountLoader<'info, User>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump,
        constraint = token_data.load()?.pools[user_account.load()?.comet.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen as u64 @ CloneError::StatusPreventsAction
    )]
    pub token_data: AccountLoader<'info, TokenData>,
    #[account(
        mut,
        address = clone.onusd_mint
    )]
    pub onusd_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = token_data.load()?.pools[user_account.load()?.comet.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
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
    let authorized_amount = to_clone_decimal!(amount);
    let token_data = ctx.accounts.token_data.load()?;
    let comet = &mut ctx.accounts.user_account.load_mut()?.comet;

    let comet_position = comet.positions[comet_position_index as usize];
    let ild_share = calculate_ild_share(&comet_position, &token_data);

    if (pay_onusd_debt && ild_share.onusd_ild_share <= Decimal::ZERO)
        || (!pay_onusd_debt && ild_share.onasset_ild_share <= Decimal::ZERO)
    {
        return Ok(());
    }

    let (cpi_accounts, burn_amount) = if pay_onusd_debt {
        let burn_amount = ild_share.onusd_ild_share.min(authorized_amount);
        comet.positions[comet_position_index as usize].onusd_ild_rebate +=
            burn_amount.mantissa() as i64;
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
        comet.positions[comet_position_index as usize].onasset_ild_rebate +=
            burn_amount.mantissa() as i64;
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
