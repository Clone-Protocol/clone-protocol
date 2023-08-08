use crate::error::*;
use crate::math::*;
use crate::states::*;
use crate::to_clone_decimal;
use crate::{return_error_if_false, CLONE_PROGRAM_SEED, POOLS_SEED, USER_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(user: Pubkey, comet_position_index: u8, amount: u64, pay_collateral_debt: bool)]
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
        seeds = [POOLS_SEED.as_ref()],
        bump,
        constraint = pools.pools[user_account.load()?.comet.positions[comet_position_index as usize].pool_index as usize].status != Status::Frozen @ CloneError::StatusPreventsAction
    )]
    pub pools: Box<Account<'info, Pools>>,
    #[account(
        mut,
        address = clone.collateral.mint
    )]
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = pools.pools[user_account.load()?.comet.positions[comet_position_index as usize].pool_index as usize].asset_info.onasset_mint,
    )]
    pub onasset_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::authority = payer,
        associated_token::mint = collateral_mint,
    )]
    pub payer_collateral_token_account: Box<Account<'info, TokenAccount>>,
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
    pay_collateral_debt: bool,
) -> Result<()> {
    return_error_if_false!(amount > 0, CloneError::InvalidTokenAmount);
    let authorized_amount = to_clone_decimal!(amount);
    let pools = &ctx.accounts.pools;
    let comet = &mut ctx.accounts.user_account.load_mut()?.comet;

    let comet_position = comet.positions[comet_position_index as usize];
    let ild_share = calculate_ild_share(&comet_position, &pools);

    if (pay_collateral_debt && ild_share.collateral_ild_share <= Decimal::ZERO)
        || (!pay_collateral_debt && ild_share.onasset_ild_share <= Decimal::ZERO)
    {
        return Ok(());
    }

    let (cpi_accounts, burn_amount) = if pay_collateral_debt {
        let burn_amount = ild_share.collateral_ild_share.min(authorized_amount);
        comet.positions[comet_position_index as usize].collateral_ild_rebate +=
            burn_amount.mantissa() as i64;
        (
            Burn {
                mint: ctx.accounts.collateral_mint.to_account_info().clone(),
                from: ctx
                    .accounts
                    .payer_collateral_token_account
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
