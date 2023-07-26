use crate::states::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CloneParameters {
    CometLiquidationFee { value: RawDecimal },
    BorrowLiquidationFee { value: RawDecimal },
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
        seeds = [b"clone".as_ref()],
        bump = clone.bump,
    )]
    pub clone: Box<Account<'info, Clone>>,
}

pub fn execute(ctx: Context<UpdateCloneParameters>, params: CloneParameters) -> Result<()> {
    match params {
        CloneParameters::CometLiquidationFee { value } => {
            ctx.accounts.clone.liquidation_config.comet_liquidator_fee = value;
        }
        CloneParameters::BorrowLiquidationFee { value } => {
            ctx.accounts.clone.liquidation_config.borrow_liquidator_fee = value;
        }
        CloneParameters::TreasuryAddress { address } => {
            ctx.accounts.clone.treasury_address = address;
        }
    }

    Ok(())
}
