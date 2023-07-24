use crate::states::*;
use anchor_lang::prelude::*;
use crate::CLONE_PROGRAM_SEED;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CloneParameters {
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
    pub clone: Account<'info, Clone>,
}

pub fn execute(ctx: Context<UpdateCloneParameters>, params: CloneParameters) -> Result<()> {
    match params {
        CloneParameters::LiquidationFee { value } => {
            ctx.accounts.clone.liquidator_fee_bps = value;
        }
        CloneParameters::TreasuryAddress { address } => {
            ctx.accounts.clone.treasury_address = address;
        }
    }

    Ok(())
}
