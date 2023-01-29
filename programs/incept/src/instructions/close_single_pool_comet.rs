//use crate::instructions::CloseSinglePoolComet;
use crate::error::*;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_spl::token::*;

#[derive(Accounts)]
#[instruction(user_nonce: u8, comet_index: u8)]
pub struct CloseSinglePoolComet<'info> {
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key.as_ref()],
        bump = user_nonce,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        constraint = single_pool_comet.load()?.owner == *user.to_account_info().key @ InceptError::InvalidAccountLoaderOwner,
        constraint = single_pool_comet.load()?.is_single_pool == 1 @ InceptError::WrongCometType,
        address = user_account.single_pool_comets
    )]
    pub single_pool_comet: AccountLoader<'info, Comet>,
    pub token_program: Program<'info, Token>,
}

pub fn execute(ctx: Context<CloseSinglePoolComet>, _user_nonce: u8, comet_index: u8) -> Result<()> {
    // remove single pool comet
    let mut single_pool_comet = ctx.accounts.single_pool_comet.load_mut()?;
    let position_index = comet_index as usize;
    let comet_position = single_pool_comet.positions[position_index];
    let collateral_position = single_pool_comet.collaterals[position_index];

    // TODO: Check liquidation status? move to a require statement w/ InceptError
    assert!(
        comet_position.liquidity_token_value.to_decimal().is_zero()
            && comet_position.borrowed_usdi.to_decimal().is_zero()
            && comet_position.borrowed_iasset.to_decimal().is_zero()
            && collateral_position.collateral_amount.to_decimal().is_zero()
    );

    single_pool_comet.remove_position(position_index);
    single_pool_comet.remove_collateral(position_index);

    Ok(())
}
