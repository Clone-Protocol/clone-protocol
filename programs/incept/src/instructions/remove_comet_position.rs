use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(comet_position_index: u8)]
pub struct RemoveCometPosition<'info> {
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
}

pub fn execute(ctx: Context<RemoveCometPosition>, comet_position_index: u8) -> Result<()> {
    let mut comet = ctx.accounts.comet.load_mut()?;

    let comet_position = comet.positions[comet_position_index as usize];
    let borrowed_usdi = comet_position.borrowed_usdi.to_decimal();
    let borrowed_iasset = comet_position.borrowed_iasset.to_decimal();
    let lp_tokens = comet_position.liquidity_token_value.to_decimal();

    return_error_if_false!(
        borrowed_usdi.is_zero() && borrowed_iasset.is_zero() && lp_tokens.is_zero(),
        InceptError::CometNotEmpty
    );

    comet.remove_position(comet_position_index.into());

    if comet.is_single_pool == 1 {
        let comet_collateral = comet.collaterals[comet_position_index as usize];
        return_error_if_false!(
            comet_collateral.collateral_amount.to_decimal().is_zero(),
            InceptError::CometNotEmpty
        );
        comet.remove_collateral(comet_position_index.into());
    }

    Ok(())
}
