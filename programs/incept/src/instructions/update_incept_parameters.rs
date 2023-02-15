use crate::states::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Copy, Debug)]
pub enum InceptParameters {
    LiquidationFee { value: RawDecimal },
    MaxHealthLiquidation { value: RawDecimal },
    TreasuryAddress { address: Pubkey },
    ChainlinkProgram { address: Pubkey },
    IlHealthScoreCoefficient { value: RawDecimal },
    IlHealthScoreCutoff { value: RawDecimal },
    IlLiquidationRewardPct { value: RawDecimal },
}

#[derive(Accounts)]
#[instruction(
    params: InceptParameters
)]
pub struct UpdateInceptParameters<'info> {
    #[account(address = incept.admin)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"incept".as_ref()],
        bump = incept.bump,
        has_one = token_data
    )]
    pub incept: Account<'info, Incept>,
    #[account(
        mut,
        has_one = incept
    )]
    pub token_data: AccountLoader<'info, TokenData>,
}

pub fn execute(ctx: Context<UpdateInceptParameters>, params: InceptParameters) -> Result<()> {
    let token_data = &mut ctx.accounts.token_data.load_mut()?;

    match params {
        InceptParameters::LiquidationFee { value } => {
            ctx.accounts.incept.liquidation_config.liquidator_fee = value;
        }
        InceptParameters::MaxHealthLiquidation { value } => {
            ctx.accounts
                .incept
                .liquidation_config
                .max_health_liquidation = value;
        }
        InceptParameters::TreasuryAddress { address } => {
            ctx.accounts.incept.treasury_address = address;
        }
        InceptParameters::ChainlinkProgram { address } => {
            token_data.chainlink_program = address;
        }
        InceptParameters::IlHealthScoreCoefficient { value } => {
            token_data.il_health_score_coefficient = value;
        }
        InceptParameters::IlHealthScoreCutoff { value } => {
            token_data.il_health_score_cutoff = value;
        }
        InceptParameters::IlLiquidationRewardPct { value } => {
            token_data.il_liquidation_reward_pct = value;
        }
    }

    Ok(())
}
