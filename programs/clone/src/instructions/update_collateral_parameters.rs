use crate::CLONE_PROGRAM_SEED;
use crate::{error::CloneError, states::*};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CollateralParameters {
    Status { status: u64 },
    OracleInfoIndex { value: u64 },
    CollateralizationRatio { value: RawDecimal },
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
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump = clone.bump,
        has_one = token_data
    )]
    pub clone: Box<Account<'info, Clone>>,
    #[account(
        mut,
        has_one = clone,
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
            if value > Status::Frozen as u64 {
                return Err(error!(CloneError::InvalidStatus));
            }
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
