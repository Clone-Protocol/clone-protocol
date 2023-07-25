use crate::error::*;
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
            if let Some(empty_slot) = clone
                .auth
                .iter_mut()
                .find(|slot| **slot == Pubkey::default())
            {
                *empty_slot = address;
            } else {
                return Err(error!(CloneError::AuthArrayFull));
            }
        }
        CloneParameters::RemoveAuth { address } => {
            if let Some(auth_slot) = clone.auth.iter_mut().find(|slot| **slot == address) {
                *auth_slot = Pubkey::default();
            } else {
                return Err(error!(CloneError::AuthNotFound));
            }
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
