use crate::error::*;
use crate::return_error_if_false;
use crate::states::*;
use crate::CLONE_PROGRAM_SEED;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CloneParameters {
    AddAuth { address: Pubkey },
    RemoveAuth { address: Pubkey },
    LiquidationFee { value: u16 },
    TreasuryAddress { address: Pubkey },
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
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
}

pub fn execute(ctx: Context<UpdateCloneParameters>, params: CloneParameters) -> Result<()> {
    let clone = &mut ctx.accounts.clone;
    match params {
        CloneParameters::AddAuth { address } => {
            let auth_array = clone.auth.clone();
            let empty_slot = auth_array
                .iter()
                .enumerate()
                .find(|(_, slot)| **slot != Pubkey::default());

            return_error_if_false!(empty_slot.is_some(), CloneError::AuthArrayFull);
            clone.auth[empty_slot.unwrap().0] = address;
        }
        CloneParameters::RemoveAuth { address } => {
            let auth_array = clone.auth.clone();
            let auth_slot = auth_array
                .iter()
                .enumerate()
                .find(|(_, slot)| **slot == address);

            return_error_if_false!(auth_slot.is_some(), CloneError::AuthNotFound);
            clone.auth[auth_slot.unwrap().0] = Pubkey::default();
        }
        CloneParameters::LiquidationFee { value } => {
            clone.liquidator_fee_bps = value;
        }
        CloneParameters::TreasuryAddress { address } => {
            clone.treasury_address = address;
        }
    }

    Ok(())
}
