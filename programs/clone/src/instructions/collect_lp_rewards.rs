use crate::error::*;
use crate::math::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use rust_decimal::prelude::*;
use std::convert::TryInto;

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct CollectLpRewards<'info> {
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
        constraint = comet.to_account_info().key() == user_account.comet @ CloneError::InvalidAccountLoaderOwner,
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
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<CollectLpRewards>, comet_position_index: u8) -> Result<()> {
    let token_data = ctx.accounts.token_data.load()?;
    let mut comet = ctx.accounts.comet.load_mut()?;

    let comet_position = comet.positions[comet_position_index as usize];

    let onusd_ild_rebate = comet_position.onusd_ild_rebate.to_decimal();
    let onasset_ild_rebate = comet_position.onasset_ild_rebate.to_decimal();
    let ild_share = calculate_ild_share(&comet_position, &token_data);

    if ild_share.onusd_ild_share < Decimal::ZERO {
        let onusd_reward = ild_share.onusd_ild_share.abs();

        // Update rebate amount such that the ild_share is now zero.
        comet.positions[comet_position_index as usize].onusd_ild_rebate = RawDecimal::from(
            rescale_toward_zero(onusd_ild_rebate - onusd_reward, DEVNET_TOKEN_SCALE),
        );

        // Mint reward amount to user
        let cpi_accounts = MintTo {
            mint: ctx.accounts.onusd_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .user_onusd_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        token::mint_to(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            onusd_reward.mantissa().try_into().unwrap(),
        )?;
    }

    if ild_share.onasset_ild_share < Decimal::ZERO {
        let onasset_reward = ild_share.onasset_ild_share.abs();

        // Update rebate amount such that the ild_share is now zero.
        comet.positions[comet_position_index as usize].onasset_ild_rebate = RawDecimal::from(
            rescale_toward_zero(onasset_ild_rebate - onasset_reward, DEVNET_TOKEN_SCALE),
        );

        // Mint reward amount to user
        let cpi_accounts = MintTo {
            mint: ctx.accounts.onasset_mint.to_account_info().clone(),
            to: ctx
                .accounts
                .user_onasset_token_account
                .to_account_info()
                .clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };
        token::mint_to(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            onasset_reward.mantissa().try_into().unwrap(),
        )?;
    }

    Ok(())
}