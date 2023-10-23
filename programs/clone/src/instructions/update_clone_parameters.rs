use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
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

            let empty_slot = auth_array
                .iter()
                .enumerate()
                .find(|(_, slot)| (**slot).eq(&Pubkey::default()));
            return_error_if_false!(empty_slot.is_some(), CloneError::AuthArrayFull);
            clone.auth[empty_slot.unwrap().0] = address;
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
            let auth_slot = auth_array
                .iter()
                .enumerate()
                .find(|(_, slot)| (**slot).eq(&address));

            return_error_if_false!(auth_slot.is_some(), CloneError::AuthNotFound);
            clone.auth[auth_slot.unwrap().0] = Pubkey::default();
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
