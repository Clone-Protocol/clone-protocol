use crate::return_error_if_false;
use crate::{error::CloneError, states::*};
use crate::{CLONE_PROGRAM_SEED, TOKEN_DATA_SEED};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CollateralParameters {
    Status { status: u64 },
    OracleInfoIndex { value: u64 },
    CollateralizationRatio { value: u64 },
}

#[derive(Accounts)]
#[instruction(
    index: u8,
    params: CollateralParameters
)]
pub struct UpdateCollateralParameters<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        seeds = [TOKEN_DATA_SEED.as_ref()],
        bump,
        constraint = (index as u64) < token_data.load()?.num_collaterals @ CloneError::CollateralNotFound,
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(
    ctx: Context<UpdateCollateralParameters>,
    index: u8,
    params: CollateralParameters,
) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;
    let collateral = &mut token_data.collaterals[index as usize];

    match params {
        CollateralParameters::Status { status: value } => {
            return_error_if_false!(value <= Status::Frozen as u64, CloneError::InvalidStatus);
            collateral.status = value;
        }
        CollateralParameters::OracleInfoIndex { value } => {
            collateral.oracle_info_index = value;
        }
        CollateralParameters::CollateralizationRatio { value } => {
            collateral.collateralization_ratio = value;
        }
    }
    Ok(())
}
