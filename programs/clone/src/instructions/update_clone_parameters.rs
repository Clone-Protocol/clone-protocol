use crate::error::*;
use crate::states::*;
use crate::{return_error_if_false, CLONE_PROGRAM_SEED};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CloneParameters {
    AddAuth { address: Pubkey },
    RemoveAuth { address: Pubkey },
    CometCollateralLiquidationFee { value: u16 },
    CometOnassetLiquidationFee { value: u16 },
    BorrowLiquidationFee { value: u16 },
    TreasuryAddress { address: Pubkey },
    CollateralizationRatio { value: u8 },
}

#[derive(Accounts)]
#[instruction(
    params: CloneParameters
)]
pub struct UpdateCloneParameters<'info> {
    #[account(address = clone.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CLONE_PROGRAM_SEED.as_ref()],
        bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
}

pub fn execute(ctx: Context<UpdateCloneParameters>, params: CloneParameters) -> Result<()> {
    let clone = &mut ctx.accounts.clone;
    match params {
        CloneParameters::AddAuth { address } => {
            let auth_array = clone.auth;

            return_error_if_false!(
                auth_array
                    .iter()
                    .find(|slot| (**slot).eq(&address))
                    .is_none(),
                CloneError::AuthAlreadyExists
            );

            if let Some(empty_slot) = auth_array
                .iter()
                .enumerate()
                .find(|(_, slot)| (**slot).eq(&Pubkey::default()))
            {
                clone.auth[empty_slot.0] = address;
            } else {
                return Err(error!(CloneError::AuthArrayFull));
            }
        }
        CloneParameters::CometCollateralLiquidationFee { value } => {
            ctx.accounts.clone.comet_collateral_ild_liquidator_fee_bps = value;
        }
        CloneParameters::CometOnassetLiquidationFee { value } => {
            ctx.accounts.clone.comet_onasset_ild_liquidator_fee_bps = value;
        }
        CloneParameters::BorrowLiquidationFee { value } => {
            clone.borrow_liquidator_fee_bps = value;
        }
        CloneParameters::RemoveAuth { address } => {
            let auth_array = clone.auth;

            if let Some(auth_slot) = auth_array
                .iter()
                .enumerate()
                .find(|(_, slot)| (**slot).eq(&address))
            {
                clone.auth[auth_slot.0] = Pubkey::default();
            } else {
                return Err(error!(CloneError::AuthNotFound));
            }
        }
        CloneParameters::TreasuryAddress { address } => {
            clone.treasury_address = address;
        }
        CloneParameters::CollateralizationRatio { value } => {
            clone.collateral.collateralization_ratio = value;
        }
    }

    Ok(())
}
