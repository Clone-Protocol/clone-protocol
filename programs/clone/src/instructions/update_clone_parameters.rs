use crate::states::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum CloneParameters {
    LiquidationFee { value: RawDecimal },
    MaxHealthLiquidation { value: RawDecimal },
    TreasuryAddress { address: Pubkey },
    IlHealthScoreCutoff { value: RawDecimal },
    IlLiquidationRewardPct { value: RawDecimal },
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
        has_one = token_data
    )]
    pub clone: Account<'info, Clone>,
    #[account(
        mut,
        has_one = clone
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<UpdateCloneParameters>, params: CloneParameters) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    match params {
        CloneParameters::LiquidationFee { value } => {
            ctx.accounts.clone.liquidation_config.liquidator_fee = value;
        }
        CloneParameters::MaxHealthLiquidation { value } => {
            ctx.accounts.clone.liquidation_config.max_health_liquidation = value;
        }
        CloneParameters::TreasuryAddress { address } => {
            ctx.accounts.clone.treasury_address = address;
        }
        CloneParameters::IlHealthScoreCutoff { value } => {
            token_data.il_health_score_cutoff = value;
        }
        CloneParameters::IlLiquidationRewardPct { value } => {
            token_data.il_liquidation_reward_pct = value;
        }
    }

    Ok(())
}
